import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";

type Merchant = {
  id: string;
  business_name: string;
  settlement_status: string;
  profiles?: {
    full_name?: string;
    kyc_status?: string;
  };
};

export const OperatorMerchantsPage = () => {
  const queryClient = useQueryClient();
  const merchantsQuery = useQuery({
    queryKey: ["operator-merchants"],
    queryFn: () => apiFetch<Merchant[]>("/admin/operator/merchants")
  });
  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "verify" | "suspend" | "reactivate" }) =>
      apiFetch(`/admin/merchants/${id}/${action}`, {
        method: "PUT"
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["operator-merchants"] });
    }
  });

  return (
    <section className="glass-panel rounded-[32px] p-6">
      <p className="text-sm uppercase tracking-[0.35em] text-ink/55">Merchant management</p>
      <h2 className="mt-3 text-3xl font-semibold">Approve, suspend, and reactivate merchants.</h2>
      <div className="mt-6 space-y-3">
        {(merchantsQuery.data ?? []).map((merchant) => (
          <article key={merchant.id} className="rounded-[22px] bg-white/55 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="font-medium">{merchant.business_name}</p>
                <p className="mt-1 text-sm text-ink/65">KYC: {merchant.profiles?.kyc_status ?? "pending"}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.25em] text-ink/50">Settlement: {merchant.settlement_status}</p>
              </div>
              <div className="flex gap-2">
                <button className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white" onClick={() => actionMutation.mutate({ id: merchant.id, action: "verify" })}>Verify</button>
                <button className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-ink" onClick={() => actionMutation.mutate({ id: merchant.id, action: "suspend" })}>Suspend</button>
                <button className="rounded-full bg-blush px-4 py-2 text-xs font-semibold text-white" onClick={() => actionMutation.mutate({ id: merchant.id, action: "reactivate" })}>Reactivate</button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

