import type { FastifyInstance } from "fastify";
import { calculateCharge } from "@detrix/billing-core";
import { SessionEngineService } from "@detrix/session-engine";
import { BlockchainAdapterService } from "@detrix/blockchain-adapter";
import { ApiError } from "../lib/api-error.js";
import { redis } from "../lib/redis.js";
import { RealtimeEmitter } from "../lib/realtime.js";
import { WalletService } from "./wallet-service.js";

type SessionRow = {
  id: string;
  user_id: string;
  venue_id: string;
  pricing_plan_id: string;
  status: "enter_detected" | "active" | "exit_detected" | "closed" | "disputed";
  entry_time: string;
  locked_rate: number | null;
  trigger_mode: "geofence" | "qr" | "self_checkout";
  superfluid_stream_id: string | null;
};

export class SessionService {
  private readonly engine = new SessionEngineService();
  private readonly emitter: RealtimeEmitter;
  private readonly walletService: WalletService;
  private readonly blockchainAdapter: BlockchainAdapterService | null;

  constructor(private readonly app: FastifyInstance) {
    this.emitter = new RealtimeEmitter(app);
    this.walletService = new WalletService(app);
    this.blockchainAdapter =
      process.env.POLYGON_RPC_URL && process.env.SUPERFLUID_PRIVATE_KEY && process.env.MERCHANT_REGISTRY_ADDRESS && process.env.SESSION_MANAGER_ADDRESS && process.env.SETTLEMENT_ANCHOR_ADDRESS
        ? new BlockchainAdapterService({
            rpcUrl: process.env.POLYGON_RPC_URL,
            privateKey: process.env.SUPERFLUID_PRIVATE_KEY,
            merchantRegistryAddress: process.env.MERCHANT_REGISTRY_ADDRESS,
            sessionManagerAddress: process.env.SESSION_MANAGER_ADDRESS,
            settlementAnchorAddress: process.env.SETTLEMENT_ANCHOR_ADDRESS
          })
        : null;
  }

  private async getVenueContext(venueId: string) {
    const [{ data: venue }, { data: geofence }, { data: pricingPlan }] = await Promise.all([
      this.app.supabase.from("venues").select("*").eq("id", venueId).maybeSingle(),
      this.app.supabase.from("geofences").select("*").eq("venue_id", venueId).maybeSingle(),
      this.app.supabase.from("pricing_plans").select("*").eq("venue_id", venueId).eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle()
    ]);

    if (!venue || !pricingPlan) {
      throw new ApiError(404, "Venue or pricing plan not found");
    }

    return { venue, geofence, pricingPlan };
  }

  private computeLockedRate(pricingPlan: Record<string, unknown>) {
    const rateCrypto = Number(pricingPlan.rate_crypto);
    const rateInrEquivalent = Number(pricingPlan.rate_inr_equivalent);
    return rateCrypto > 0 ? Number((rateInrEquivalent / rateCrypto).toFixed(8)) : rateInrEquivalent;
  }

  private async getActiveSession(userId: string, venueId?: string) {
    let query = this.app.supabase
      .from("sessions")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["enter_detected", "active", "exit_detected"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (venueId) {
      query = query.eq("venue_id", venueId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw new ApiError(400, error.message);
    }

    return data as SessionRow | null;
  }

  async getCurrentActiveSession(userId: string) {
    return this.getActiveSession(userId);
  }

  async handleLocationEvent(params: {
    userId: string;
    venueId: string;
    lat: number;
    lng: number;
    occurredAt: string;
    idempotencyKey: string;
  }) {
    const idempotencyKey = `idem:location:${params.userId}:${params.idempotencyKey}`;
    const reserved = await redis.set(idempotencyKey, "1", "EX", 120, "NX");

    if (!reserved) {
      throw new ApiError(409, "Duplicate location event");
    }

    const activeSession = await this.getActiveSession(params.userId, params.venueId);
    const { venue, geofence, pricingPlan } = await this.getVenueContext(params.venueId);
    const wallet = await this.walletService.getWalletByUser(params.userId);

    if (!activeSession) {
      if (Number(wallet.balance_inr_equivalent) < Number(pricingPlan.minimum_charge_inr)) {
        throw new ApiError(409, "Wallet balance below minimum charge");
      }

      const lockedRate = this.computeLockedRate(pricingPlan);
      const { data, error } = await this.app.supabase
        .from("sessions")
        .insert({
          user_id: params.userId,
          venue_id: params.venueId,
          pricing_plan_id: pricingPlan.id,
          status: "enter_detected",
          trigger_mode: "geofence",
          entry_lat: params.lat,
          entry_lng: params.lng,
          entry_time: params.occurredAt,
          locked_rate: lockedRate,
          platform_fee_rate: Number(process.env.PLATFORM_FEE_RATE ?? 0.005)
        })
        .select("*")
        .single();

      if (error || !data) {
        throw new ApiError(400, error?.message ?? "Could not create session");
      }

      await this.logEvent(data.id, "entered", { mode: "geofence", lat: params.lat, lng: params.lng });
      this.emitter.emitToUser(params.userId, "session:enter_detected", data);
      this.emitter.emitToMerchant(venue.merchant_id, "merchant:session_new", data);

      return data;
    }

    if (!geofence) {
      throw new ApiError(404, "Venue geofence not found");
    }

    const lastTransitionAt = new Date((activeSession as unknown as { updated_at?: string }).updated_at ?? activeSession.entry_time).getTime();
    const elapsedSinceLastTransitionSeconds = Math.max(1, Math.floor((new Date(params.occurredAt).getTime() - lastTransitionAt) / 1000));
    const evaluation = this.engine.evaluateLocation({
      status: activeSession.status,
      geofence:
        geofence.type === "circle"
          ? {
              type: "circle",
              center: {
                lat: Number(geofence.center_lat),
                lng: Number(geofence.center_lng)
              },
              radiusMeters: Number(geofence.radius_meters)
            }
          : {
              type: "polygon",
              coordinates: geofence.polygon_coordinates
            },
      point: { lat: params.lat, lng: params.lng },
      elapsedSinceLastTransitionSeconds,
      gracePeriodSeconds: Number(pricingPlan.grace_period_seconds)
    });

    if (evaluation.nextStatus === "active" && activeSession.status !== "active") {
      const streamReference = `ledger_${activeSession.id}`;
      const { data, error } = await this.app.supabase
        .from("sessions")
        .update({
          status: "active",
          superfluid_stream_id: streamReference
        })
        .eq("id", activeSession.id)
        .select("*")
        .single();

      if (error || !data) {
        throw new ApiError(400, error?.message ?? "Could not activate session");
      }

      await this.logEvent(activeSession.id, "billing_started", { streamReference, lockedRate: activeSession.locked_rate });
      this.emitter.emitToUser(params.userId, "session:started", data);
      this.emitter.emitToMerchant(venue.merchant_id, "merchant:dashboard_update", data);
      return data;
    }

    if (evaluation.nextStatus === "exit_detected") {
      const { data, error } = await this.app.supabase
        .from("sessions")
        .update({
          status: "exit_detected"
        })
        .eq("id", activeSession.id)
        .select("*")
        .single();

      if (error || !data) {
        throw new ApiError(400, error?.message ?? "Could not mark exit");
      }

      await this.logEvent(activeSession.id, "exited", { lat: params.lat, lng: params.lng });
      this.emitter.emitToUser(params.userId, "session:exit_detected", data);
      return data;
    }

    if (evaluation.nextStatus === "closed") {
      return this.closeSession({
        sessionId: activeSession.id,
        userId: params.userId,
        exitLat: params.lat,
        exitLng: params.lng,
        exitTime: params.occurredAt,
        triggerMode: "geofence"
      });
    }

    return activeSession;
  }

  async startQrSession(params: {
    userId: string;
    venueId: string;
    pricingPlanId: string;
    nonce: string;
  }) {
    const { venue } = await this.getVenueContext(params.venueId);
    const wallet = await this.walletService.getWalletByUser(params.userId);
    const { data: pricingPlan } = await this.app.supabase.from("pricing_plans").select("*").eq("id", params.pricingPlanId).maybeSingle();

    if (!pricingPlan) {
      throw new ApiError(404, "Pricing plan not found");
    }

    if (Number(wallet.balance_inr_equivalent) < Number(pricingPlan.minimum_charge_inr)) {
      throw new ApiError(409, "Wallet balance below minimum charge");
    }

    const existing = await this.getActiveSession(params.userId, params.venueId);
    if (existing) {
      throw new ApiError(409, "Active session already exists");
    }

    const lockedRate = this.computeLockedRate(pricingPlan);
    const streamReference = `${process.env.SESSION_BILLING_PROVIDER ?? "ledger"}_${params.userId}_${Date.now()}`;
    const { data, error } = await this.app.supabase
      .from("sessions")
      .insert({
        user_id: params.userId,
        venue_id: params.venueId,
        pricing_plan_id: params.pricingPlanId,
        status: "active",
        trigger_mode: "qr",
        qr_nonce_used: params.nonce,
        entry_time: new Date().toISOString(),
        locked_rate: lockedRate,
        superfluid_stream_id: streamReference,
        platform_fee_rate: Number(process.env.PLATFORM_FEE_RATE ?? 0.005)
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new ApiError(400, error?.message ?? "Could not create QR session");
    }

    if (this.blockchainAdapter && process.env.SESSION_BILLING_PROVIDER === "superfluid") {
      await this.blockchainAdapter.startSessionStream({
        session: data,
        merchantId: venue.merchant_id,
        venueId: params.venueId,
        userId: params.userId,
        pricingPlanId: params.pricingPlanId,
        streamReference
      });
    }

    await this.logEvent(data.id, "billing_started", { mode: "qr", nonce: params.nonce });
    this.emitter.emitToUser(params.userId, "session:started", data);
    this.emitter.emitToMerchant(venue.merchant_id, "merchant:session_new", data);
    return data;
  }

  async closeSession(params: {
    sessionId: string;
    userId: string;
    exitLat?: number;
    exitLng?: number;
    exitTime: string;
    triggerMode: "geofence" | "qr" | "self_checkout";
  }) {
    const { data: session, error } = await this.app.supabase.from("sessions").select("*").eq("id", params.sessionId).maybeSingle();

    if (error || !session) {
      throw new ApiError(404, "Session not found");
    }

    if (session.user_id !== params.userId) {
      throw new ApiError(403, "Forbidden");
    }

    const [{ data: pricingPlan }, { data: venue }, wallet] = await Promise.all([
      this.app.supabase.from("pricing_plans").select("*").eq("id", session.pricing_plan_id).maybeSingle(),
      this.app.supabase.from("venues").select("*").eq("id", session.venue_id).maybeSingle(),
      this.walletService.getWalletByUser(params.userId)
    ]);

    if (!pricingPlan || !venue) {
      throw new ApiError(404, "Pricing plan or venue not found");
    }

    const exitTime = new Date(params.exitTime);
    const entryTime = new Date(session.entry_time);
    const elapsedSeconds = Math.max(1, Math.floor((exitTime.getTime() - entryTime.getTime()) / 1000));
    const lockedRate = Number(session.locked_rate ?? this.computeLockedRate(pricingPlan));
    const preview = calculateCharge({
      elapsedSeconds,
      billingUnit: pricingPlan.billing_unit,
      rateCrypto: Number(pricingPlan.rate_crypto),
      lockedRate,
      minimumChargeInr: Number(pricingPlan.minimum_charge_inr),
      maximumCapInr: pricingPlan.maximum_cap_inr ? Number(pricingPlan.maximum_cap_inr) : null,
      baseFeeInr: Number(pricingPlan.base_fee_inr),
      platformFeeRate: Number(process.env.PLATFORM_FEE_RATE ?? 0.005)
    });

    const affordableGross = Math.min(preview.grossInr, Number(wallet.balance_inr_equivalent));
    const affordableCrypto = affordableGross === preview.grossInr
      ? preview.cryptoAmount
      : Number((affordableGross / lockedRate).toFixed(8));
    const affordableFee = Number((affordableGross * Number(process.env.PLATFORM_FEE_RATE ?? 0.005)).toFixed(2));
    const affordableMerchant = Number((affordableGross - affordableFee).toFixed(2));

    await this.walletService.debitForSession({
      userId: params.userId,
      inrAmount: affordableGross,
      cryptoAmount: affordableCrypto,
      exchangeRate: lockedRate,
      sessionId: session.id
    });

    const { data: updatedSession, error: updateError } = await this.app.supabase
      .from("sessions")
      .update({
        status: "closed",
        trigger_mode: params.triggerMode,
        exit_time: exitTime.toISOString(),
        exit_lat: params.exitLat,
        exit_lng: params.exitLng,
        duration_seconds: elapsedSeconds,
        locked_rate: lockedRate,
        crypto_charged: affordableCrypto,
        inr_equivalent: affordableGross,
        platform_fee_inr: affordableFee,
        merchant_payout_inr: affordableMerchant,
        platform_fee_rate: Number(process.env.PLATFORM_FEE_RATE ?? 0.005)
      })
      .eq("id", session.id)
      .select("*")
      .single();

    if (updateError || !updatedSession) {
      throw new ApiError(400, updateError?.message ?? "Could not update session");
    }

    const operatorLedgerResult = await this.app.supabase.from("operator_ledger").insert({
      session_id: session.id,
      merchant_id: venue.merchant_id,
      venue_id: session.venue_id,
      gross_inr: affordableGross,
      fee_rate: Number(process.env.PLATFORM_FEE_RATE ?? 0.005),
      fee_inr: affordableFee
    });

    if (operatorLedgerResult.error && !operatorLedgerResult.error.message.includes("duplicate")) {
      throw new ApiError(400, operatorLedgerResult.error.message);
    }

    await this.logEvent(session.id, "closed", {
      grossInr: affordableGross,
      operatorFeeInr: affordableFee,
      merchantPayoutInr: affordableMerchant,
      triggerMode: params.triggerMode
    });

    if (
      this.blockchainAdapter &&
      process.env.SESSION_BILLING_PROVIDER === "superfluid" &&
      process.env.CHAIN_FALLBACK_PAYOUT_ADDRESS
    ) {
      await this.blockchainAdapter.anchorSettlement({
        sessionId: session.id,
        merchantId: venue.merchant_id,
        venueId: session.venue_id,
        merchantPayoutAddress: process.env.CHAIN_FALLBACK_PAYOUT_ADDRESS,
        grossAmountInMinorUnits: BigInt(Math.round(affordableGross * 100)),
        operatorFeeInMinorUnits: BigInt(Math.round(affordableFee * 100)),
        finalSettlement: {
          cryptoAmount: affordableCrypto,
          grossInr: affordableGross,
          feeInr: affordableFee,
          netMerchantInr: affordableMerchant,
          stoppedAt: exitTime.toISOString()
        }
      });
    }

    this.emitter.emitToUser(params.userId, "session:closed", updatedSession);
    this.emitter.emitToUser(params.userId, "billing:settled", {
      sessionId: session.id,
      walletBalanceAfter: Number(wallet.balance_inr_equivalent) - affordableGross
    });
    this.emitter.emitToMerchant(venue.merchant_id, "merchant:session_ended", updatedSession);
    this.emitter.emitToMerchant(venue.merchant_id, "merchant:dashboard_update", {
      type: "session_closed",
      session: updatedSession
    });
    this.emitter.emitToOperator("billing:settled", {
      sessionId: session.id,
      feeInr: affordableFee,
      grossInr: affordableGross,
      triggerMode: params.triggerMode
    });

    return updatedSession;
  }

  async selfCheckout(params: { userId: string; sessionId: string }) {
    return this.closeSession({
      sessionId: params.sessionId,
      userId: params.userId,
      exitTime: new Date().toISOString(),
      triggerMode: "self_checkout"
    });
  }

  private async logEvent(sessionId: string, eventType: string, payload: unknown) {
    await this.app.supabase.from("session_events").insert({
      session_id: sessionId,
      event_type: eventType,
      payload
    });
  }
}
