import { Worker, Queue } from "bullmq";
import { createServiceSupabaseClient } from "@detrix/supabase-client";
import { logger } from "../logger.js";

const QUEUE_NAME = "settlement-t-plus-one";
const connection = { url: process.env.REDIS_URL ?? "redis://localhost:6379" };

// ── Queue export (shared by API layer to enqueue jobs) ─────────────────────

export const settlementQueue = new Queue(QUEUE_NAME, { connection });

export const scheduleDailyRun = () =>
  settlementQueue.upsertJobScheduler(
    "daily-settlement",
    { pattern: "1 0 * * *", tz: "Asia/Kolkata" },
    { name: "process-daily-settlement", data: {} }
  );

// ── Worker ─────────────────────────────────────────────────────────────────

export const startWorker = () => {
  const supabase = createServiceSupabaseClient();

  const worker = new Worker<Record<string, unknown>>(
    QUEUE_NAME,
    async (job) => {
      const now = new Date();
      // Default to previous day in IST (batch runs at 00:01)
      const batchDate =
        (job.data.batchDate as string | undefined) ??
        new Date(now.getTime() - 24 * 60 * 60 * 1000).toLocaleDateString("en-CA", {
          timeZone: "Asia/Kolkata"
        });

      logger.info({ msg: "settlement_worker_start", batchDate, jobId: job.id });

      // Pull unsettled sessions
      const start = `${batchDate}T00:00:00+05:30`;
      const end = `${batchDate}T23:59:59+05:30`;

      const { data: sessions, error } = await supabase
        .from("sessions")
        .select("id,merchant_payout_inr,platform_fee_inr,inr_equivalent,venue_id,venues!inner(merchant_id)")
        .eq("status", "closed")
        .is("settlement_batch_id", null)
        .gte("created_at", start)
        .lte("created_at", end);

      if (error) throw new Error(error.message);

      const grouped = new Map<string, typeof sessions>();
      for (const s of sessions ?? []) {
        const mid = s.venues?.merchant_id;
        if (!mid) continue;
        grouped.set(mid, [...(grouped.get(mid) ?? []), s]);
      }

      const results: string[] = [];

      for (const [merchantId, rows] of grouped.entries()) {
        const gross = rows.reduce((acc, r) => acc + Number(r.inr_equivalent), 0);
        const fee = rows.reduce((acc, r) => acc + Number(r.platform_fee_inr), 0);
        const net = rows.reduce((acc, r) => acc + Number(r.merchant_payout_inr), 0);

        const { data: batch, error: bErr } = await supabase
          .from("settlement_batches")
          .insert({
            merchant_id: merchantId,
            batch_date: batchDate,
            total_sessions: rows.length,
            gross_inr: gross,
            platform_fee_inr: fee,
            net_inr: net,
            status: "processing",
            initiated_at: new Date().toISOString()
          })
          .select("id")
          .single();

        if (bErr || !batch) {
          logger.error({ msg: "settlement_batch_insert_failed", merchantId, err: bErr?.message });
          continue;
        }

        const ids = rows.map((r) => r.id);
        await supabase.from("sessions").update({ settlement_batch_id: batch.id }).in("id", ids);
        await supabase.from("operator_ledger").update({ settlement_batch_id: batch.id }).in("session_id", ids);

        // Payout handled by API-layer SettlementDomainService with Razorpay; here we just mark processing
        logger.info({ msg: "settlement_batch_created", batchId: batch.id, merchantId, net });
        results.push(batch.id);
      }

      logger.info({ msg: "settlement_worker_done", batchDate, batchesCreated: results.length });
      return { batchDate, batchesCreated: results };
    },
    {
      connection,
      concurrency: 1,
      limiter: { max: 1, duration: 1000 },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 30_000 }
      }
    }
  );

  worker.on("completed", (job, result) => {
    logger.info({ msg: "settlement_job_completed", jobId: job.id, result });
  });

  worker.on("failed", (job, err) => {
    logger.error({ msg: "settlement_job_failed", jobId: job?.id, err: err.message });
  });

  // Graceful shutdown
  const shutdown = async () => {
    logger.info({ msg: "settlement_worker_shutdown" });
    await worker.close();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown());
  process.on("SIGINT", () => void shutdown());

  return worker;
};
