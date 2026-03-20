import { Queue } from "bullmq";
import { createServiceSupabaseClient } from "@detrix/supabase-client";

export class SettlementService {
  private readonly supabase = createServiceSupabaseClient();
  private readonly queue = new Queue("settlement-t-plus-one", {
    connection: {
      url: process.env.REDIS_URL
    }
  });

  async scheduleDailyRun() {
    return this.queue.upsertJobScheduler("daily-settlement", {
      pattern: "1 0 * * *",
      tz: "Asia/Kolkata"
    }, {
      name: "process-daily-settlement",
      data: {}
    });
  }

  async listUnsettledSessionsForDate(batchDate: string) {
    return this.supabase
      .from("sessions")
      .select("id, venue_id, merchant_payout_inr, platform_fee_inr, trigger_mode")
      .eq("status", "closed")
      .is("settlement_batch_id", null)
      .gte("created_at", `${batchDate}T00:00:00+05:30`)
      .lt("created_at", `${batchDate}T23:59:59+05:30`);
  }
}

