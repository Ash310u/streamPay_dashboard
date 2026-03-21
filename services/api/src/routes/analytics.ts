import type { FastifyInstance } from "fastify";
import { OperatorAnalyticsService } from "@detrix/operator-analytics";
import { TaxAssistantService } from "@detrix/tax-assistant";
import { requireRole, sendApiError } from "../lib/guards.js";
import { AnalyticsService } from "../services/analytics-service.js";

const operatorAnalytics = new OperatorAnalyticsService();
const taxAssistant = new TaxAssistantService();

export const registerAnalyticsRoutes = async (app: FastifyInstance) => {
  const analyticsService = new AnalyticsService(app);

  app.get("/analytics/revenue", async (request, reply) => {
    try {
      const user = requireRole(request, ["merchant", "admin"]);
      const data = await analyticsService.getMerchantRevenueSeries(user.id);
      return reply.send(data);
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  app.get("/merchants/me/tax-summary", async (request, reply) => {
    try {
      const user = requireRole(request, ["merchant", "admin"]);
      const financialYear = ((request.query as { financialYear?: string }).financialYear ?? "2025-2026");
      const context = await taxAssistant.buildContext(user.id, financialYear);
      return reply.send(context);
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  app.get("/admin/operator/live", async (request, reply) => {
    try {
      requireRole(request, ["admin"]);
      const result = await operatorAnalytics.getLiveFeed();
      return reply.send(result.data);
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  app.get("/analytics/customer-overview", async (request, reply) => {
    try {
      const user = requireRole(request, ["user", "admin"]);
      const data = await analyticsService.getCustomerDashboardStats(user.id);
      return reply.send(data);
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  app.get("/merchants/me/analytics", async (request, reply) => {
    try {
      const user = requireRole(request, ["merchant", "admin"]);
      const data = await analyticsService.getMerchantDashboardStats(user.id);
      return reply.send(data);
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  app.get("/analytics/occupancy", async (request, reply) => {
    try {
      const user = requireRole(request, ["merchant", "admin"]);
      const sessions = await analyticsService.getMerchantRevenueSeries(user.id);
      const heatmap = Array.from({ length: 7 }, (_, day) =>
        Array.from({ length: 24 }, (_, hour) => ({
          day,
          hour,
          count: sessions.filter((session) => {
            const date = new Date(session.created_at);
            return date.getDay() === day && date.getHours() === hour;
          }).length
        }))
      ).flat();

      return reply.send(heatmap);
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  app.get("/analytics/export", async (request, reply) => {
    try {
      const user = requireRole(request, ["merchant", "admin"]);
      const sessions = await analyticsService.getMerchantRevenueSeries(user.id);
      const header = "created_at,venue_id,inr_equivalent,platform_fee_inr,merchant_payout_inr,trigger_mode";
      const rows = sessions.map((item) =>
        [item.created_at, item.venue_id, item.inr_equivalent, item.platform_fee_inr, item.merchant_payout_inr, item.trigger_mode].join(",")
      );

      reply.header("Content-Type", "text/csv");
      return reply.send([header, ...rows].join("\n"));
    } catch (error) {
      return sendApiError(reply, error);
    }
  });
  /** Full operator analytics (for OperatorAnalyticsPage dashboard) */
  app.get("/analytics/operator", async (request, reply) => {
    try {
      requireRole(request, ["admin"]);

      const [dailyResult, sessionsResult, merchantsResult] = await Promise.all([
        app.supabase
          .from("operator_ledger")
          .select("gross_inr,fee_inr,created_at,venues!inner(category)")
          .order("created_at", { ascending: true })
          .limit(90),
        app.supabase
          .from("sessions")
          .select("id,created_at")
          .order("created_at", { ascending: true }),
        app.supabase
          .from("merchants")
          .select("id")
          .eq("settlement_status", "completed")
      ]);

      // Aggregate daily revenue
      const dailyMap = new Map<string, { revenue: number; sessions: number; fees: number }>();
      for (const row of dailyResult.data ?? []) {
        const date = row.created_at.slice(0, 10);
        const prev = dailyMap.get(date) ?? { revenue: 0, sessions: 0, fees: 0 };
        dailyMap.set(date, {
          revenue: prev.revenue + Number(row.gross_inr),
          sessions: prev.sessions,
          fees: prev.fees + Number(row.fee_inr)
        });
      }
      for (const row of sessionsResult.data ?? []) {
        const date = row.created_at.slice(0, 10);
        const prev = dailyMap.get(date) ?? { revenue: 0, sessions: 0, fees: 0 };
        dailyMap.set(date, { ...prev, sessions: prev.sessions + 1 });
      }

      const daily = [...dailyMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-30)
        .map(([date, vals]) => ({ date, ...vals }));

      // By category
      const catMap = new Map<string, number>();
      for (const row of dailyResult.data ?? []) {
        const cat = (row as any).venues?.category ?? "other";
        catMap.set(cat, (catMap.get(cat) ?? 0) + Number((row as any).gross_inr ?? 0));
      }
      const byCategory = [...catMap.entries()].map(([category, value]) => ({ category, value }));

      // Top merchants
      const mMap = new Map<string, { name: string; revenue: number }>();
      for (const row of dailyResult.data ?? []) {
        const mid = (row as any).merchant_id ?? "";
        if (!mMap.has(mid)) mMap.set(mid, { name: mid.slice(0, 8), revenue: 0 });
        mMap.get(mid)!.revenue += Number((row as any).gross_inr ?? 0);
      }
      const topMerchants = [...mMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8);

      const totalRevenue = daily.reduce((s, r) => s + r.revenue, 0);
      const totalSessions = sessionsResult.data?.length ?? 0;
      const totalFees = daily.reduce((s, r) => s + r.fees, 0);
      const activeMerchants = merchantsResult.data?.length ?? 0;

      return reply.send({
        daily,
        byCategory,
        topMerchants,
        summary: { totalRevenue, totalSessions, totalFees, activeMerchants }
      });
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  /** Merchant sessions list (supports mobile live-sessions polling) */
  app.get("/analytics/merchant-sessions", async (request, reply) => {
    try {
      const user = requireRole(request, ["merchant", "admin"]);
      const statusFilter = (request.query as { status?: string }).status;
      const { data: venueRows, error: venueError } = await app.supabase
        .from("venues")
        .select("id")
        .eq("merchant_id", user.id);

      if (venueError) {
        return reply.status(400).send({ error: venueError.message });
      }

      const venueIds = (venueRows ?? []).map((row) => row.id);

      if (!venueIds.length) {
        return reply.send([]);
      }

      let query = app.supabase
        .from("sessions")
        .select("id,user_id,venue_id,status,entry_time,exit_time,inr_equivalent,crypto_charged,trigger_mode")
        .in("venue_id", venueIds)
        .order("created_at", { ascending: false })
        .limit(100);

      if (statusFilter) query = query.eq("status", statusFilter);

      const { data, error } = await query;
      if (error) return reply.status(400).send({ error: error.message });
      return reply.send(data ?? []);
    } catch (error) {
      return sendApiError(reply, error);
    }
  });
};
