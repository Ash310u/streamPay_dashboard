import { useState } from "react";
import {
  useGetOperatorSettlementsQuery,
  useRetryOperatorSettlementMutation,
  useRunAdminSettlementMutation
} from "../store/api";

type Settlement = {
  id: string;
  merchant_id: string;
  batch_date: string;
  gross_inr: number;
  platform_fee_inr: number;
  net_inr: number;
  crypto_paid: number;
  status: string;
  merchants?: {
    business_name?: string;
  };
};

const Spinner = () => (
  <div className="flex items-center justify-center py-8">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet border-t-transparent" />
  </div>
);

export const OperatorSettlementsPage = () => {
  const [settlementDate, setSettlementDate] = useState(new Date().toISOString().slice(0, 10));

  const { data: settlements = [], isLoading, isError, refetch } = useGetOperatorSettlementsQuery();

  const [retrySettlement, { isLoading: isRetryPending }] = useRetryOperatorSettlementMutation();
  const [runSettlement, { isLoading: isRunPending, isSuccess: isRunSuccess, isError: isRunError, error: runError }] = useRunAdminSettlementMutation();

  return (
    <div className="space-y-5">
      <section className="glass-panel rounded-[32px] p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-ink/55">Settlement management</p>
            <h2 className="mt-3 text-3xl font-semibold">Merchant payouts and settlement batches.</h2>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={settlementDate}
              onChange={(e) => setSettlementDate(e.target.value)}
              className="rounded-2xl border border-white/40 bg-white/55 px-4 py-3 text-sm outline-none"
            />
            <button
              onClick={() => void runSettlement(settlementDate)}
              disabled={isRunPending}
              className="rounded-full bg-blush px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {isRunPending ? "Running…" : "Run settlement"}
            </button>
          </div>
        </div>
        {isRunSuccess && (
          <p className="mt-3 text-sm text-emerald-600">Settlement batch created for {settlementDate}!</p>
        )}
        {isRunError && (
          <p className="mt-3 text-sm text-rose-600">{(runError as any)?.data?.error || "Error running settlement"}</p>
        )}
      </section>

      {isLoading ? (
        <Spinner />
      ) : isError ? (
        <div className="glass-panel rounded-[32px] p-6">
          <p className="text-sm text-rose-600">Failed to load settlements.</p>
          <button onClick={() => void refetch()} className="mt-2 rounded-full bg-rose-100 px-4 py-2 text-xs font-semibold text-rose-700">
            Retry
          </button>
        </div>
      ) : settlements.length === 0 ? (
        <p className="rounded-[24px] bg-white/55 p-5 text-sm text-ink/55">No settlement records yet.</p>
      ) : (
        <section className="glass-panel overflow-hidden rounded-[32px]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/20 text-left text-xs uppercase tracking-[0.25em] text-ink/50">
                <th className="px-5 py-4">Batch date</th>
                <th className="px-5 py-4">Merchant</th>
                <th className="px-5 py-4">Gross INR</th>
                <th className="px-5 py-4">Platform fee</th>
                <th className="px-5 py-4">Net INR</th>
                <th className="px-5 py-4">Crypto paid</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {settlements.map((settlement) => (
                <tr key={settlement.id} className="border-b border-white/10 transition hover:bg-white/10">
                  <td className="px-5 py-3">{settlement.batch_date}</td>
                  <td className="px-5 py-3">{settlement.merchants?.business_name ?? settlement.merchant_id.slice(0, 8)}</td>
                  <td className="px-5 py-3 font-semibold">₹{Number(settlement.gross_inr ?? 0).toFixed(2)}</td>
                  <td className="px-5 py-3">₹{Number(settlement.platform_fee_inr ?? 0).toFixed(2)}</td>
                  <td className="px-5 py-3 font-semibold">₹{Number(settlement.net_inr ?? 0).toFixed(2)}</td>
                  <td className="px-5 py-3 font-mono text-xs">{Number(settlement.crypto_paid ?? 0).toFixed(6)}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      settlement.status === "completed"
                        ? "bg-emerald-100 text-emerald-700"
                        : settlement.status === "failed"
                        ? "bg-rose-100 text-rose-700"
                        : "bg-amber-100 text-amber-700"
                    }`}>
                      {settlement.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {settlement.status === "failed" && (
                      <button
                        onClick={() => void retrySettlement(settlement.id)}
                        disabled={isRetryPending}
                        className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700 disabled:opacity-60"
                      >
                        Retry
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
};
