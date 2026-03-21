import type { FastifyInstance } from "fastify";
import { ApiError } from "../lib/api-error.js";
import { logger } from "../lib/logger.js";
import { NotificationService } from "@detrix/notification";
import { RealtimeEmitter } from "../lib/realtime.js";
import { RateService } from "./rate-service.js";
import * as Razorpay from "../lib/razorpay.js";

export class SettlementDomainService {
  private readonly notificationService = new NotificationService();
  private readonly realtimeEmitter: RealtimeEmitter;
  private readonly rateService: RateService;

  constructor(private readonly app: FastifyInstance) {
    this.realtimeEmitter = new RealtimeEmitter(app);
    this.rateService = new RateService(app);
  }

  async runTPlusOneSettlement(batchDate: string) {
    const start = `${batchDate}T00:00:00+05:30`;
    const end = `${batchDate}T23:59:59+05:30`;

    // Fetch current USDC/INR rate for audit
    let lockedRateUsdc: number | null = null;
    try {
      lockedRateUsdc = await this.rateService.getInrRate("USDC");
    } catch {
      logger.warn({ msg: "settlement_rate_fetch_failed", batchDate });
    }

    const { data: sessions, error } = await this.app.supabase
      .from("sessions")
      .select("id,merchant_payout_inr,platform_fee_inr,inr_equivalent,venue_id,venues!inner(merchant_id)")
      .eq("status", "closed")
      .is("settlement_batch_id", null)
      .gte("created_at", start)
      .lte("created_at", end);

    if (error) {
      throw new ApiError(400, error.message);
    }

    const grouped = new Map<string, NonNullable<typeof sessions>>();

    for (const session of sessions ?? []) {
      const joinedVenue = Array.isArray(session.venues) ? session.venues[0] : session.venues;
      const merchantId = joinedVenue?.merchant_id;
      if (!merchantId) continue;
      grouped.set(merchantId, [...(grouped.get(merchantId) ?? []), session]);
    }

    const results: Array<{ merchantId: string; batchId: string; payoutId?: string }> = [];

    for (const [merchantId, merchantSessions] of grouped.entries()) {
      const gross = merchantSessions.reduce((s, r) => s + Number(r.inr_equivalent), 0);
      const platformFee = merchantSessions.reduce((s, r) => s + Number(r.platform_fee_inr), 0);
      const net = merchantSessions.reduce((s, r) => s + Number(r.merchant_payout_inr), 0);

      // Fetch merchant for Razorpay fund account details
      const { data: merchant } = await this.app.supabase
        .from("merchants")
        .select("razorpay_fund_account_id,business_name")
        .eq("id", merchantId)
        .maybeSingle();

      const { data: batch, error: batchError } = await this.app.supabase
        .from("settlement_batches")
        .insert({
          merchant_id: merchantId,
          batch_date: batchDate,
          total_sessions: merchantSessions.length,
          gross_inr: gross,
          platform_fee_inr: platformFee,
          net_inr: net,
          locked_rate_usdc: lockedRateUsdc,
          status: "processing",
          initiated_at: new Date().toISOString()
        })
        .select("*")
        .single();

      if (batchError || !batch) {
        throw new ApiError(400, batchError?.message ?? "Could not create settlement batch");
      }

      const sessionIds = merchantSessions.map((s) => s.id);
      await this.app.supabase.from("sessions").update({ settlement_batch_id: batch.id }).in("id", sessionIds);
      await this.app.supabase.from("operator_ledger").update({ settlement_batch_id: batch.id }).in("session_id", sessionIds);

      // Execute real Razorpay payout when fund account is available
      let payoutId: string | undefined;

      if (merchant?.razorpay_fund_account_id && Razorpay.isConfigured() && net > 0) {
        try {
          const payout = await Razorpay.createPayout(
            merchant.razorpay_fund_account_id,
            Math.round(net * 100), // convert to paise
            `detrix_${batch.id}`,
            `Detrix T+1 settlement ${batchDate}`,
            { batchId: batch.id, merchantId }
          );
          payoutId = payout.id;
          logger.info({ msg: "payout_created", payoutId, merchantId, net });
        } catch (err) {
          logger.error({ msg: "payout_failed", merchantId, err: String(err) });
          // Mark batch as failed; webhook will handle successful retry status
          await this.app.supabase
            .from("settlement_batches")
            .update({ status: "failed" })
            .eq("id", batch.id);
          continue;
        }
      }

      // Update batch with payout id (or mark completed directly for merchants without fund accounts)
      await this.app.supabase
        .from("settlement_batches")
        .update({
          razorpay_payout_id: payoutId ?? `manual_${batch.id}`,
          // Only set completed immediately if no real payout was initiated (webhook changes it later)
          ...(payoutId ? {} : { status: "completed", completed_at: new Date().toISOString() })
        })
        .eq("id", batch.id);

      await this.notificationService.createInAppNotification(
        merchantId,
        "Settlement initiated",
        `T+1 settlement for ${batchDate} of INR ${net.toFixed(2)} has been initiated.`,
        "settlement"
      );

      this.realtimeEmitter.emitToMerchant(merchantId, "billing:settled", {
        batchId: batch.id,
        batchDate,
        netInr: net
      });

      this.realtimeEmitter.emitToOperator("merchant:dashboard_update", {
        type: "settlement_initiated",
        merchantId,
        batchId: batch.id,
        netInr: net,
        payoutId
      });

      results.push({ merchantId, batchId: batch.id, payoutId });
    }

    return results;
  }

  /** Create Razorpay contact + fund account for a merchant and persist the IDs */
  async provisionMerchantPayoutAccount(merchantId: string) {
    const { data: merchant, error } = await this.app.supabase
      .from("merchants")
      .select("*")
      .eq("id", merchantId)
      .maybeSingle();

    if (error || !merchant) throw new ApiError(404, "Merchant not found");

    if (merchant.razorpay_contact_id && merchant.razorpay_fund_account_id) {
      return {
        contactId: merchant.razorpay_contact_id,
        fundAccountId: merchant.razorpay_fund_account_id
      };
    }

    if (!Razorpay.isConfigured()) {
      logger.warn({ msg: "razorpay_not_configured_skipping_fund_account", merchantId });
      return { contactId: null, fundAccountId: null };
    }

    if (!merchant.bank_account_number || !merchant.bank_ifsc || !merchant.bank_account_name) {
      throw new ApiError(400, "Merchant bank details are incomplete");
    }

    // 1) Create contact
    const { data: profile } = await this.app.supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", merchantId)
      .maybeSingle();

    const contact = await Razorpay.createContact(
      merchant.business_name ?? profile?.full_name ?? merchantId,
      null,
      profile?.phone ?? null
    );

    // 2) Create fund account
    const fundAccount = await Razorpay.createBankFundAccount(
      contact.id,
      merchant.bank_account_name,
      merchant.bank_account_number,
      merchant.bank_ifsc
    );

    // 3) Persist
    await this.app.supabase
      .from("merchants")
      .update({
        razorpay_contact_id: contact.id,
        razorpay_fund_account_id: fundAccount.id
      })
      .eq("id", merchantId);

    logger.info({ msg: "merchant_payout_account_provisioned", merchantId, contactId: contact.id, fundAccountId: fundAccount.id });
    return { contactId: contact.id, fundAccountId: fundAccount.id };
  }
}
