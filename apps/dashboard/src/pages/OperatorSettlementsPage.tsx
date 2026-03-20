import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";

type Settlement = {
  id: string;
  merchant_id: string;
  batch_date: string;
  net_inr: number;
  status: string;
};

export const OperatorSettlementsPage = () => {
  const queryClient = useQueryClient();
  const settlementsQuery = useQuery({
    queryKey: ["operator-settlements"],
    queryFn: () => apiFetch<Settlement[]>("/admin/operator/settlements")
  });
  const retryMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/operator/settlements/${id}/retry`, {
        method: "POST"
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["operator-settlements"] });
    }
  });

  return (
    <section className="glass-panel rounded-[32px] p-6">
      <p className="text-sm uppercase tracking-[0.35em] text-ink/55">Settlement oversight</p>
      <h2 className="mt-3 text-3xl font-semibold">Review and retry payout batches.</h2>
      <div className="mt-6 overflow-hidden rounded-[24px] bg-white/50">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/60 text-ink/55">
            <tr>
              <th className="px-4 py-3">Batch date</th>
              <th className="px-4 py-3">Merchant</th>
              <th className="px-4 py-3">Net</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {(settlementsQuery.data ?? []).map((item) => (
              <tr key={item.id} className="border-t border-white/40">
                <td className="px-4 py-3">{item.batch_date}</td>
                <td className="px-4 py-3">{item.merchant_id}</td>
                <td className="px-4 py-3">INR {Number(item.net_inr ?? 0).toFixed(2)}</td>
                <td className="px-4 py-3">{item.status}</td>
                <td className="px-4 py-3">
                  <button className="rounded-full bg-blush px-4 py-2 text-xs font-semibold text-white" onClick={() => retryMutation.mutate(item.id)}>
                    Retry
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
