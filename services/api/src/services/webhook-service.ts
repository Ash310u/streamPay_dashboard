import type { FastifyInstance } from "fastify";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../lib/env.js";
import { ApiError } from "../lib/api-error.js";
import { logger } from "../lib/logger.js";
import { redisSetValue } from "../lib/redis.js";
import { RateService } from "./rate-service.js";
import { WalletService } from "./wallet-service.js";
import { RealtimeEmitter } from "../lib/realtime.js";

export class WebhookService {
  private readonly rateService: RateService;
  private readonly walletService: WalletService;
  private readonly emitter: RealtimeEmitter;

  constructor(private readonly app: FastifyInstance) {
    this.rateService = new RateService(app);
    this.walletService = new WalletService(app);
    this.emitter = new RealtimeEmitter(app);
  }

  verifySignature(payload: string, signature: string): boolean {
    if (!env.RAZORPAY_WEBHOOK_SECRET) {
      logger.warn({ msg: "webhook_secret_not_configured" });
      return false;
    }

    const digest = createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET).update(payload).digest("hex");

    try {
      return timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  async processRazorpayWebhook(body: Record<string, unknown>) {
    const event = String(body.event ?? "");
    const paymentEntity = this.extractEntity(body, "payment");
    const payoutEntity = this.extractEntity(body, "payout");
    const orderEntity = this.extractEntity(body, "order");

    // De-duplicate using a stable event key
    const entityId =
      paymentEntity?.id ?? payoutEntity?.id ?? orderEntity?.id ?? `event_${Date.now()}`;
    const replayKey = `webhook:razorpay:${event}:${entityId}`;
    const firstSeen = await redisSetValue(replayKey, "1", { ttlSeconds: 60 * 60 * 24 * 7, nx: true });

    if (!firstSeen) {
      logger.info({ msg: "webhook_duplicate_skipped", event, entityId });
      return { duplicate: true };
    }

    logger.info({ msg: "webhook_received", event, entityId });

    switch (event) {
      case "payment.captured":
        return this.onPaymentCaptured(paymentEntity);

      case "payment.failed":
        return this.onPaymentFailed(paymentEntity);

      case "payment.refunded":
        return this.onPaymentRefunded(paymentEntity);

      case "order.paid":
        return this.onOrderPaid(orderEntity, paymentEntity);

      case "payout.processed":
        return this.onPayoutSettled(payoutEntity, "completed");

      case "payout.failed":
        return this.onPayoutSettled(payoutEntity, "failed");

      case "payout.reversed":
        return this.onPayoutSettled(payoutEntity, "failed");

      default:
        logger.info({ msg: "webhook_unhandled_event", event });
        return { accepted: true, event };
    }
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  private async onPaymentCaptured(entity: Record<string, unknown> | null) {
    if (!entity) throw new ApiError(400, "Missing payment entity");

    const userId = (entity as any).notes?.userId as string | undefined;
    const amountInPaise = Number((entity as any).amount ?? 0);
    const paymentId = String((entity as any).id ?? "");

    if (!userId || !amountInPaise) {
      throw new ApiError(400, "Missing payment metadata for captured payment");
    }

    const exchangeRate = await this.rateService.getInrRate("USDC");
    const wallet = await this.walletService.creditTopUp({
      userId,
      inrAmount: Number((amountInPaise / 100).toFixed(2)),
      paymentId,
      exchangeRate
    });

    this.emitter.emitToUser(userId, "billing:charge_update", { wallet });
    logger.info({ msg: "payment_captured_credited", userId, paymentId, inrAmount: amountInPaise / 100 });
    return { credited: true, userId, wallet };
  }

  private async onPaymentFailed(entity: Record<string, unknown> | null) {
    if (!entity) return { accepted: true };

    const userId = (entity as any).notes?.userId as string | undefined;
    const paymentId = String((entity as any).id ?? "");

    if (userId) {
      this.emitter.emitToUser(userId, "billing:payment_failed", { paymentId });

      // Notify in-app
      await this.app.supabase.from("notifications").insert({
        user_id: userId,
        title: "Payment failed",
        body: "Your payment could not be processed. Please try again.",
        type: "billing"
      });
    }

    logger.warn({ msg: "payment_failed", userId, paymentId });
    return { acknowledged: true, paymentId };
  }

  private async onPaymentRefunded(entity: Record<string, unknown> | null) {
    if (!entity) return { accepted: true };

    const userId = (entity as any).notes?.userId as string | undefined;
    const amountInPaise = Number((entity as any).amount_refunded ?? 0);
    const paymentId = String((entity as any).id ?? "");

    if (userId && amountInPaise > 0) {
      const exchangeRate = await this.rateService.getInrRate("USDC");
      const wallet = await this.walletService.creditTopUp({
        userId,
        inrAmount: Number((amountInPaise / 100).toFixed(2)),
        paymentId: `refund_${paymentId}`,
        exchangeRate
      });
      this.emitter.emitToUser(userId, "billing:charge_update", { wallet });
      logger.info({ msg: "payment_refunded_credited", userId, paymentId, inrAmount: amountInPaise / 100 });
      return { refunded: true, userId, wallet };
    }

    return { accepted: true };
  }

  private async onOrderPaid(
    orderEntity: Record<string, unknown> | null,
    paymentEntity: Record<string, unknown> | null
  ) {
    const orderId = String(orderEntity?.id ?? paymentEntity?.order_id ?? "");
    const userId = String(
      (orderEntity as any)?.notes?.userId ?? (paymentEntity as any)?.notes?.userId ?? ""
    );

    // Mark wallet_top_up_orders row as confirmed if schema supports it
    if (orderId) {
      await this.app.supabase
        .from("wallet_top_up_orders")
        .update({ status: "paid" })
        .eq("razorpay_order_id", orderId)
        .throwOnError();
    }

    if (userId) {
      this.emitter.emitToUser(userId, "billing:order_paid", { orderId });
    }

    logger.info({ msg: "order_paid", orderId, userId });
    return { accepted: true, orderId };
  }

  private async onPayoutSettled(entity: Record<string, unknown> | null, status: "completed" | "failed") {
    if (!entity) return { accepted: true };

    const payoutId = String((entity as any).id ?? "");

    if (payoutId) {
      await this.app.supabase
        .from("settlement_batches")
        .update({
          status,
          ...(status === "completed" ? { completed_at: new Date().toISOString() } : {})
        })
        .eq("razorpay_payout_id", payoutId);

      logger.info({ msg: "payout_status_updated", payoutId, status });
    }

    return { payoutUpdated: true, payoutId, status };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private extractEntity(body: Record<string, unknown>, key: string): Record<string, unknown> | null {
    const payload = body.payload;
    if (payload && typeof payload === "object") {
      const section = (payload as Record<string, unknown>)[key];
      if (section && typeof section === "object") {
        return ((section as Record<string, unknown>).entity as Record<string, unknown>) ?? null;
      }
    }
    return null;
  }
}
