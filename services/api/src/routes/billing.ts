import type { FastifyInstance } from "fastify";
import { calculateCharge } from "@detrix/billing-core";
import { disputeSchema } from "@detrix/zod-schemas";
import { requireAuth, sendApiError } from "../lib/guards.js";

export const registerBillingRoutes = async (app: FastifyInstance) => {
  app.get("/billing/preview", async (request, reply) => {
    const query = request.query as Record<string, string>;
    const result = calculateCharge({
      elapsedSeconds: Number(query.elapsedSeconds ?? 60),
      billingUnit: (query.billingUnit as "per_second" | "per_minute" | "per_hour") ?? "per_minute",
      rateCrypto: Number(query.rateCrypto ?? 0.01),
      lockedRate: Number(query.lockedRate ?? 83),
      minimumChargeInr: Number(query.minimumChargeInr ?? 20),
      maximumCapInr: query.maximumCapInr ? Number(query.maximumCapInr) : null,
      baseFeeInr: Number(query.baseFeeInr ?? 0),
      platformFeeRate: Number(process.env.PLATFORM_FEE_RATE ?? 0.005)
    });

    return reply.send(result);
  });

  app.get("/billing/receipts/:id", async (request, reply) => {
    try {
      requireAuth(request);
      const sessionId = (request.params as { id: string }).id;
      const { data, error } = await app.supabase.from("sessions").select("*").eq("id", sessionId).maybeSingle();

      if (error) {
        return reply.status(400).send({ error: error.message });
      }

      return reply.send(data);
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  app.post("/billing/refund/:id", async (request, reply) => {
    try {
      requireAuth(request);
      const sessionId = (request.params as { id: string }).id;
      return reply.status(202).send({
        sessionId,
        status: "queued"
      });
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  app.post("/sessions/:id/dispute", async (request, reply) => {
    try {
      const user = requireAuth(request);
      const payload = disputeSchema.parse(request.body);
      const sessionId = (request.params as { id: string }).id;
      const { data, error } = await app.supabase
        .from("sessions")
        .update({ status: "disputed" })
        .eq("id", sessionId)
        .select("*")
        .single();

      if (error) {
        return reply.status(400).send({ error: error.message });
      }

      await app.supabase.from("session_events").insert({
        session_id: sessionId,
        event_type: "error",
        payload: {
          type: "dispute",
          reason: payload.reason,
          raisedBy: user.id
        }
      });

      return reply.send(data);
    } catch (error) {
      return sendApiError(reply, error);
    }
  });
};
