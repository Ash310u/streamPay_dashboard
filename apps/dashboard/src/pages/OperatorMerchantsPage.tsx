import {
  useGetOperatorMerchantsQuery,
  useGetAdminMerchantsQuery,
  useVerifyMerchantMutation,
  useSuspendMerchantMutation,
  useReactivateMerchantMutation
} from "../store/api";

type Merchant = {
  id: string;
  business_name: string;
  business_type: string;
  gstin: string;
  kyc_status: string;
  settlement_status: string;
  onboarded_at: string;
  profiles?: {
    full_name?: string;
    email?: string;
    phone?: string;
  };
};

const Spinner = () => (
  <div className="flex items-center justify-center py-8">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet border-t-transparent" />
  </div>
);

export const OperatorMerchantsPage = () => {
  const { data: operatorMerchants = [], isLoading: isOpLoading } = useGetOperatorMerchantsQuery();
  const { data: adminMerchants = [], isLoading: isAdminLoading } = useGetAdminMerchantsQuery();

  const [verifyMerchant, { isLoading: isVerifyPending }] = useVerifyMerchantMutation();
  const [suspendMerchant, { isLoading: isSuspendPending }] = useSuspendMerchantMutation();
  const [reactivateMerchant, { isLoading: isReactivatePending }] = useReactivateMerchantMutation();

  // Merge both sources, deduplicating by ID
  const allMerchants = (() => {
    const map = new Map<string, any>();
    for (const m of operatorMerchants) map.set(m.id, m);
    for (const m of adminMerchants) {
      if (!map.has(m.id)) map.set(m.id, m);
    }
    return [...map.values()];
  })();

  const isLoading = isOpLoading || isAdminLoading;

  return (
    <div className="space-y-5">
      <section className="glass-panel rounded-[32px] p-6">
        <p className="text-sm uppercase tracking-[0.35em] text-ink/55">Platform merchants</p>
        <h2 className="mt-3 text-3xl font-semibold">Merchant verification and management.</h2>
      </section>

      {isLoading ? <Spinner /> : allMerchants.length === 0 ? (
        <p className="rounded-[24px] bg-white/55 p-5 text-sm text-ink/55">No merchants onboarded yet.</p>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {allMerchants.map((merchant: any) => (
            <article key={merchant.id} className="glass-panel rounded-[28px] p-6 transition hover:-translate-y-1">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold">{merchant.business_name}</h3>
                  <p className="mt-1 text-sm text-ink/65">{merchant.business_type} · GSTIN {merchant.gstin}</p>
                  {merchant.profiles && (
                    <p className="mt-1 text-xs text-ink/50">
                      {merchant.profiles.full_name} · {merchant.profiles.email} · {merchant.profiles.phone}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-ink/45">
                    Onboarded: {merchant.onboarded_at ? new Date(merchant.onboarded_at).toLocaleDateString() : "—"}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${merchant.kyc_status === "verified"
                      ? "bg-emerald-100 text-emerald-700"
                      : merchant.kyc_status === "suspended"
                        ? "bg-rose-100 text-rose-700"
                        : "bg-amber-100 text-amber-700"
                    }`}>
                    {merchant.kyc_status}
                  </span>
                  <p className="mt-2 text-xs text-ink/45">Settlement: {merchant.settlement_status}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {merchant.kyc_status !== "verified" && (
                  <button
                    onClick={() => void verifyMerchant(merchant.id)}
                    disabled={isVerifyPending}
                    className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
                  >
                    Verify
                  </button>
                )}
                {merchant.kyc_status !== "suspended" && (
                  <button
                    onClick={() => void suspendMerchant(merchant.id)}
                    disabled={isSuspendPending}
                    className="rounded-full bg-amber-500 px-4 py-2 text-xs font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
                  >
                    Suspend
                  </button>
                )}
                {merchant.kyc_status === "suspended" && (
                  <button
                    onClick={() => void reactivateMerchant(merchant.id)}
                    disabled={isReactivatePending}
                    className="rounded-full bg-sky-500 px-4 py-2 text-xs font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
                  >
                    Reactivate
                  </button>
                )}
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
};