import type { FastifyInstance } from "fastify";
import Razorpay from "razorpay";
import { topUpOrderSchema } from "@detrix/zod-schemas";
import { env } from "../lib/env.js";
import { requireAuth, sendApiError } from "../lib/guards.js";
import { WalletService } from "../services/wallet-service.js";

const razorpay = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID,
  key_secret: env.RAZORPAY_KEY_SECRET
});

export const registerWalletRoutes = async (app: FastifyInstance) => {
  const walletService = new WalletService(app);

  app.post("/wallet/topup/order", async (request, reply) => {
    try {
      const user = requireAuth(request);
      const payload = topUpOrderSchema.parse(request.body);
      const order = await razorpay.orders.create({
        amount: Math.round(payload.amountInr * 100),
        currency: payload.currency,
        receipt: `topup_${user.id}_${Date.now()}`,
        notes: {
          userId: user.id
        }
      });

      return reply.send(order);
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
