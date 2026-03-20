import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";

type Settlement = {
  id: string;
  batch_date: string;
  total_sessions: number;
  gross_inr: number;
  net_inr: number;
  status: string;
  razorpay_payout_id?: string;
};

export const MerchantSettlementsPage = () => {
  const settlementsQuery = useQuery({
    queryKey: ["merchant-settlements"],
    queryFn: () => apiFetch<Settlement[]>("/merchants/me/settlements")
  });

  return (
    <section className="glass-panel rounded-[32px] p-6">
      <p className="text-sm uppercase tracking-[0.35em] text-ink/55">Settlements</p>
      <h2 className="mt-3 text-3xl font-semibold">T+1 batches and payout status.</h2>
      <div className="mt-6 overflow-hidden rounded-[24px] bg-white/50">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/60 text-ink/55">
            <tr>
              <th className="px-4 py-3">Batch date</th>
              <th className="px-4 py-3">Sessions</th>
              <th className="px-4 py-3">Gross</th>
              <th className="px-4 py-3">Net</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Reference</th>
            </tr>
          </thead>
          <tbody>
            {(settlementsQuery.data ?? []).map((item) => (
              <tr key={item.id} className="border-t border-white/40">
                <td className="px-4 py-3">{item.batch_date}</td>
                <td className="px-4 py-3">{item.total_sessions}</td>
                <td className="px-4 py-3">INR {Number(item.gross_inr ?? 0).toFixed(2)}</td>
                <td className="px-4 py-3">INR {Number(item.net_inr ?? 0).toFixed(2)}</td>
                <td className="px-4 py-3">{item.status}</td>
                <td className="px-4 py-3">{item.razorpay_payout_id ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

