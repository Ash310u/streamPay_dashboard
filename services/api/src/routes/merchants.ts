import type { FastifyInstance } from "fastify";
import { requireAuth, requireRole, sendApiError } from "../lib/guards.js";

export const registerMerchantRoutes = async (app: FastifyInstance) => {
  app.get("/merchants/me", async (request, reply) => {
    try {
      const user = requireRole(request, ["merchant", "admin"]);
      const { data, error } = await app.supabase.from("merchants").select("*").eq("id", user.id).maybeSingle();

      if (error) {
        return reply.status(400).send({ error: error.message });
      }

      return reply.send(data);
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  app.post("/merchants/onboard", async (request, reply) => {
    try {
      const user = requireAuth(request);
      const payload = request.body as Record<string, string>;
      const { data, error } = await app.supabase.from("merchants").upsert({
        id: user.id,
        business_name: payload.businessName,
        business_type: payload.businessType,
        gstin: payload.gstin,
        pan_number: payload.panNumber,
        bank_account_number: payload.bankAccountNumber,
        bank_ifsc: payload.bankIfsc,
        bank_account_name: payload.bankAccountName,
        upi_id: payload.upiId
      }).select("*").single();

      if (error) {
        return reply.status(400).send({ error: error.message });
      }

      return reply.status(201).send(data);
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  app.get("/merchants/me/sessions", async (request, reply) => {
    try {
      const user = requireRole(request, ["merchant", "admin"]);
      const { data, error } = await app.supabase
        .from("sessions")
        .select("*, venues!inner(merchant_id,name,city)")
        .eq("venues.merchant_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        return reply.status(400).send({ error: error.message });
      }

      return reply.send(data);
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  app.get("/merchants/me/settlements", async (request, reply) => {
    try {
      const user = requireRole(request, ["merchant", "admin"]);
      const { data, error } = await app.supabase
        .from("settlement_batches")
        .select("*")
        .eq("merchant_id", user.id)
        .order("batch_date", { ascending: false });

      if (error) {
        return reply.status(400).send({ error: error.message });
      }

      return reply.send(data);
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  app.get("/merchants/me/venues", async (request, reply) => {
    try {
      const user = requireRole(request, ["merchant", "admin"]);
      const { data, error } = await app.supabase.from("venues").select("*").eq("merchant_id", user.id).order("created_at", { ascending: false });

      if (error) {
        return reply.status(400).send({ error: error.message });
      }

      return reply.send(data);
    } catch (error) {
      return sendApiError(reply, error);
    }
  });
};
