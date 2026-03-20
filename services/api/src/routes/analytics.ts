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
};
