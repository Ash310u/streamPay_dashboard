import type { FastifyInstance } from "fastify";
import { requireRole, sendApiError } from "../lib/guards.js";
import { SettlementDomainService } from "../services/settlement-domain-service.js";

export const registerAdminRoutes = async (app: FastifyInstance) => {
  const settlementService = new SettlementDomainService(app);

  app.get("/admin/merchants", async (request, reply) => {
    try {
      requireRole(request, ["admin"]);
      const { data, error } = await app.supabase.from("merchants").select("*").order("onboarded_at", { ascending: false });

      if (error) {
        return reply.status(400).send({ error: error.message });
      }

      return reply.send(data);
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  app.put("/admin/merchants/:id/verify", async (request, reply) => {
    try {
      requireRole(request, ["admin"]);
      const merchantId = (request.params as { id: string }).id;
      await app.supabase.from("profiles").update({
        role: "merchant",
        kyc_status: "verified"
      }).eq("id", merchantId);

      return reply.status(204).send();
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  app.put("/admin/merchants/:id/suspend", async (request, reply) => {
    try {
      requireRole(request, ["admin"]);
      const merchantId = (request.params as { id: string }).id;
      await app.supabase.from("profiles").update({ role: "merchant" }).eq("id", merchantId);
      await app.supabase.from("merchants").update({ settlement_status: "failed" }).eq("id", merchantId);
      return reply.status(204).send();
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  app.put("/admin/merchants/:id/reactivate", async (request, reply) => {
    try {
      requireRole(request, ["admin"]);
      const merchantId = (request.params as { id: string }).id;
      await app.supabase.from("merchants").update({ settlement_status: "pending" }).eq("id", merchantId);
      return reply.status(204).send();
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  app.get("/admin/operator/stats", async (request, reply) => {
    try {
      requireRole(request, ["admin"]);
      const [ledger, merchants, users, activeSessions] = await Promise.all([
        app.supabase.from("operator_ledger").select("fee_inr,gross_inr,recorded_at"),
        app.supabase.from("merchants").select("id", { count: "exact", head: true }),
        app.supabase.from("profiles").select("id", { count: "exact", head: true }),
        app.supabase.from("sessions").select("id", { count: "exact", head: true }).eq("status", "active")
      ]);

      return reply.send({
        ledger: ledger.data ?? [],
        totalMerchants: merchants.count ?? 0,
        totalUsers: users.count ?? 0,
        activeSessions: activeSessions.count ?? 0
      });
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  app.get("/admin/operator/revenue", async (request, reply) => {
    try {
      requireRole(request, ["admin"]);
      const { data, error } = await app.supabase.from("operator_ledger").select("recorded_at,fee_inr,gross_inr").order("recorded_at", { ascending: true });

      if (error) {
        return reply.status(400).send({ error: error.message });
      }

      return reply.send(data);
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  app.get("/admin/operator/ledger", async (request, reply) => {
    try {
      requireRole(request, ["admin"]);
      const { data, error } = await app.supabase.from("operator_ledger").select("*").order("recorded_at", { ascending: false });

      if (error) {
        return reply.status(400).send({ error: error.message });
      }

      return reply.send(data);
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  app.get("/admin/operator/sessions", async (request, reply) => {
    try {
      requireRole(request, ["admin"]);
      const { data, error } = await app.supabase.from("sessions").select("*").order("created_at", { ascending: false });

      if (error) {
        return reply.status(400).send({ error: error.message });
      }

      return reply.send(data);
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  app.get("/admin/operator/settlements", async (request, reply) => {
    try {
      requireRole(request, ["admin"]);
      const { data, error } = await app.supabase.from("settlement_batches").select("*").order("batch_date", { ascending: false });

      if (error) {
        return reply.status(400).send({ error: error.message });
      }

      return reply.send(data);
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  app.get("/admin/operator/merchants", async (request, reply) => {
    try {
      requireRole(request, ["admin"]);
      const { data, error } = await app.supabase.from("merchants").select("*, profiles!inner(full_name,kyc_status)").order("onboarded_at", { ascending: false });
      if (error) {
        return reply.status(400).send({ error: error.message });
      }
      return reply.send(data);
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  app.post("/admin/settlements/run", async (request, reply) => {
    try {
      requireRole(request, ["admin"]);
      const batchDate = (request.body as { batchDate?: string } | undefined)?.batchDate ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const result = await settlementService.runTPlusOneSettlement(batchDate);
      return reply.send({
        batchDate,
        result
      });
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  app.post("/admin/operator/settlements/:id/retry", async (request, reply) => {
    try {
      requireRole(request, ["admin"]);
      const batchId = (request.params as { id: string }).id;
      const { data: batch } = await app.supabase.from("settlement_batches").select("*").eq("id", batchId).maybeSingle();
      if (!batch) {
        return reply.status(404).send({ error: "Settlement batch not found" });
      }
      await app.supabase.from("settlement_batches").update({
        status: "processing",
        initiated_at: new Date().toISOString(),
      }).eq("id", batchId);
      await app.supabase.from("settlement_batches").update({
        completed_at: new Date().toISOString(),
        status: "completed",
        razorpay_payout_id: batch.razorpay_payout_id ?? `retry_${batchId}`
      }).eq("id", batchId);
      return reply.send({ batchId, retried: true });
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  app.get("/admin/operator/export/ledger", async (request, reply) => {
    try {
      requireRole(request, ["admin"]);
      const { data, error } = await app.supabase.from("operator_ledger").select("*").order("recorded_at", { ascending: false });
      if (error) {
        return reply.status(400).send({ error: error.message });
      }
      const header = "recorded_at,session_id,merchant_id,venue_id,gross_inr,fee_rate,fee_inr";
      const rows = (data ?? []).map((item) =>
        [item.recorded_at, item.session_id, item.merchant_id, item.venue_id, item.gross_inr, item.fee_rate, item.fee_inr].join(",")
      );
      reply.header("Content-Type", "text/csv");
      return reply.send([header, ...rows].join("\n"));
    } catch (error) {
      return sendApiError(reply, error);
    }
  });
};
