import type { FastifyInstance } from "fastify";
import { topUpOrderSchema } from "@detrix/zod-schemas";
import { env } from "../lib/env.js";
import { ApiError } from "../lib/api-error.js";
import { requireAuth, sendApiError } from "../lib/guards.js";
import { WalletService } from "../services/wallet-service.js";
import { createOrder, isConfigured as isRazorpayConfigured } from "../lib/razorpay.js";

export const registerWalletRoutes = async (app: FastifyInstance) => {
  const walletService = new WalletService(app);

  app.post("/wallet/topup/order", async (request, reply) => {
    try {
      const user = requireAuth(request);
      const payload = topUpOrderSchema.parse(request.body);
      const exceedsKycThreshold = payload.amountInr > 10_000;
      const { data: profile } = await app.supabase
        .from("profiles")
        .select("kyc_status")
        .eq("id", user.id)
        .maybeSingle();

      if (exceedsKycThreshold && profile?.kyc_status !== "verified") {
        throw new ApiError(403, "KYC verification is required for top-ups above INR 10,000");
      }

      const receipt = `topup_${user.id}_${Date.now()}`;
      const order = isRazorpayConfigured()
        ? await createOrder(Math.round(payload.amountInr * 100), receipt, { userId: user.id })
        : {
            id: `demo_order_${Date.now()}`,
            amount: Math.round(payload.amountInr * 100),
            currency: payload.currency,
            status: "created",
            receipt
          };

      await app.supabase.from("wallet_top_up_orders").insert({
        user_id: user.id,
        amount_inr: payload.amountInr,
        currency_code: payload.currency,
        razorpay_order_id: order.id,
        status: order.status
      });

      return reply.send({
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        status: order.status,
        receipt: order.receipt,
        keyId: env.RAZORPAY_KEY_ID,
        mode: isRazorpayConfigured() ? "live" : "demo"
      });
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  app.get("/wallet/balance", async (request, reply) => {
    try {
      const user = requireAuth(request);
      const data = await walletService.getWalletByUser(user.id);
      return reply.send(data);
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  app.post("/wallet/topup/verify", async (request, reply) => {
    try {
      const user = requireAuth(request);
      const payload = request.body as {
        amountInr: number;
        paymentId?: string;
        exchangeRate?: number;
      };
      const wallet = await walletService.creditTopUp({
        userId: user.id,
        inrAmount: payload.amountInr,
        paymentId: payload.paymentId,
        exchangeRate: payload.exchangeRate
      });

      app.io.to(`user:${user.id}`).emit("billing:charge_update", {
        wallet
      });

      return reply.send(wallet);
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  app.get("/wallet/transactions", async (request, reply) => {
    try {
      const user = requireAuth(request);
      const transactions = await walletService.listTransactions(user.id);
      return reply.send(transactions);
    } catch (error) {
      return sendApiError(reply, error);
    }
  });
};
