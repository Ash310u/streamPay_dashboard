import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { locationEventSchema, qrStartSchema, qrStopSchema } from "@detrix/zod-schemas";
import { SessionEngineService } from "@detrix/session-engine";
import { signQrPayload } from "@detrix/qr-utils";
import { requireAuth, requireRole, sendApiError } from "../lib/guards.js";
import { redis } from "../lib/redis.js";
import { SessionService } from "../services/session-service.js";

const engine = new SessionEngineService();

export const registerSessionRoutes = async (app: FastifyInstance) => {
  const sessionService = new SessionService(app);

  app.post("/sessions/location-event", async (request, reply) => {
    try {
      const user = requireAuth(request);
      const payload = locationEventSchema.parse(request.body);
      const data = await sessionService.handleLocationEvent({
        userId: user.id,
        venueId: payload.venueId,
        lat: payload.lat,
        lng: payload.lng,
        occurredAt: payload.occurredAt,
        idempotencyKey: payload.idempotencyKey
      });

      return reply.send(data);
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  app.post("/sessions/qr-start", async (request, reply) => {
    try {
      const user = requireAuth(request);
      const payload = qrStartSchema.parse(request.body);
      const nonceKey = `qr:entry:${payload.token.nonce}`;
      const nonceReserved = await redis.set(nonceKey, user.id, "EX", 600, "NX");

      if (!nonceReserved) {
        return reply.status(409).send({ error: "QR nonce already used" });
      }

      const { data: venue } = await app.supabase.from("venues").select("merchant_id").eq("id", payload.token.venueId).maybeSingle();
      const { data: merchant } = await app.supabase.from("merchants").select("qr_secret").eq("id", venue?.merchant_id).maybeSingle();
      const valid = merchant?.qr_secret
        ? engine.validateQrToken({
            payload: {
              venueId: payload.token.venueId,
              pricingPlanId: payload.token.pricingPlanId,
              nonce: payload.token.nonce,
              expiresAt: payload.token.expiresAt
            },
            signature: payload.token.signature,
            secret: merchant.qr_secret
          })
        : false;

      if (!valid) {
        await redis.del(nonceKey);
        return reply.status(400).send({ error: "Invalid or expired QR token" });
      }

      const data = await sessionService.startQrSession({
        userId: user.id,
        venueId: payload.token.venueId,
        pricingPlanId: payload.token.pricingPlanId,
        nonce: payload.token.nonce
      });

      return reply.status(201).send(data);
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  app.post("/sessions/qr-stop", async (request, reply) => {
    try {
      const user = requireAuth(request);
      const payload = qrStopSchema.parse(request.body);
      const nonceKey = `qr:exit:${payload.token.nonce}`;
      const nonceReserved = await redis.set(nonceKey, user.id, "EX", 600, "NX");

      if (!nonceReserved) {
        return reply.status(409).send({ error: "QR nonce already used" });
      }

      const activeSession = await sessionService.getCurrentActiveSession(user.id);

      if (!activeSession || activeSession.venue_id !== payload.token.venueId) {
        return reply.status(404).send({ error: "Active session not found" });
      }

      const data = await sessionService.closeSession({
        sessionId: activeSession.id,
        userId: user.id,
        exitTime: new Date().toISOString(),
        triggerMode: "qr"
      });

      return reply.send(data);
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  app.post("/venues/:id/qr/generate", async (request, reply) => {
    requireRole(request, ["merchant", "admin"]);

    const venueId = (request.params as { id: string }).id;
    const query = request.query as { type?: "entry" | "exit"; pricingPlanId?: string; demo?: string };
    const type = query.type ?? "entry";
    const isDemo = query.demo === "true";
    const expiresAt = new Date(Date.now() + (isDemo ? 24 * 60 * 60 : 5 * 60) * 1000).toISOString();
    const nonce = randomUUID();

    const { data: venue } = await app.supabase.from("venues").select("merchant_id").eq("id", venueId).maybeSingle();
    const { data: merchant } = await app.supabase.from("merchants").select("qr_secret").eq("id", venue?.merchant_id).maybeSingle();

    if (!merchant?.qr_secret) {
      return reply.status(400).send({ error: "Merchant QR secret missing" });
    }

    const payload = {
      venueId,
      pricingPlanId: query.pricingPlanId,
      action: type === "exit" ? "exit" : undefined,
      nonce,
      expiresAt
    } as const;

    const signature = signQrPayload(payload, merchant.qr_secret);
    const { data, error } = await app.supabase.from("venue_qr_codes").insert({
      venue_id: venueId,
      type,
      nonce,
      signature,
      expires_at: expiresAt,
      is_demo: isDemo
    }).select("*").single();

    if (error) {
      return reply.status(400).send({ error: error.message });
    }

    return reply.status(201).send({
      qrCode: {
        ...payload,
        signature
      },
      record: data
    });
  });

  app.get("/venues/:id/qr", async (request, reply) => {
    requireRole(request, ["merchant", "admin"]);

    const venueId = (request.params as { id: string }).id;
    const { data, error } = await app.supabase.from("venue_qr_codes").select("*").eq("venue_id", venueId).gte("expires_at", new Date().toISOString()).order("created_at", { ascending: false });

    if (error) {
      return reply.status(400).send({ error: error.message });
    }

    return reply.send(data);
  });

  app.get("/sessions/active", async (request, reply) => {
    try {
      const user = requireAuth(request);
      const session = await sessionService.getCurrentActiveSession(user.id);
      return reply.send(session);
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  app.post("/sessions/:id/checkout", async (request, reply) => {
    try {
      const user = requireAuth(request);
      const sessionId = (request.params as { id: string }).id;
      const session = await sessionService.selfCheckout({
        userId: user.id,
        sessionId
      });

      return reply.send(session);
    } catch (error) {
      return sendApiError(reply, error);
    }
  });
};
