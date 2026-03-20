import { createServiceSupabaseClient } from "@detrix/supabase-client";

export class OperatorAnalyticsService {
  private readonly supabase = createServiceSupabaseClient();

  async getLiveFeed(limit = 50) {
    return this.supabase
      .from("operator_ledger")
      .select("recorded_at, fee_inr, gross_inr, session_id, merchant_id, venue_id")
      .order("recorded_at", { ascending: false })
      .limit(limit);
  }

  async getFeeRevenueRange(from: string, to: string) {
    return this.supabase
      .from("operator_ledger")
      .select("fee_inr, gross_inr, recorded_at")
      .gte("recorded_at", from)
      .lte("recorded_at", to);
  }
}
