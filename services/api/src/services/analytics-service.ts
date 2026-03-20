import type { FastifyInstance } from "fastify";
import { ApiError } from "../lib/api-error.js";

export class AnalyticsService {
  constructor(private readonly app: FastifyInstance) {}

  async getMerchantRevenueSeries(merchantId: string) {
    const { data, error } = await this.app.supabase
      .from("sessions")
      .select("created_at,inr_equivalent,platform_fee_inr,merchant_payout_inr,trigger_mode,venue_id,venues!inner(merchant_id,category,name)")
      .eq("status", "closed")
      .eq("venues.merchant_id", merchantId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new ApiError(400, error.message);
    }

    return data ?? [];
  }

  async getMerchantDashboardStats(merchantId: string) {
    const revenueSeries = await this.getMerchantRevenueSeries(merchantId);
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthSessions = revenueSeries.filter((item) => {
      const date = new Date(item.created_at);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    return {
      totalRevenueThisMonth: monthSessions.reduce((sum, item) => sum + Number(item.inr_equivalent), 0),
      totalSessionsThisMonth: monthSessions.length,
      averageSessionValue: monthSessions.length ? monthSessions.reduce((sum, item) => sum + Number(item.inr_equivalent), 0) / monthSessions.length : 0,
      platformFeePaid: monthSessions.reduce((sum, item) => sum + Number(item.platform_fee_inr), 0)
    };
  }

  async getCustomerDashboardStats(userId: string) {
    const { data, error } = await this.app.supabase
      .from("sessions")
      .select("created_at,inr_equivalent,duration_seconds,venues(name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      throw new ApiError(400, error.message);
    }

    return data ?? [];
  }
}

