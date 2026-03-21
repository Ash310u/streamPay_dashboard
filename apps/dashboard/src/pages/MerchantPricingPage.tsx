import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch } from "../lib/api";

type PricingPlan = {
  id: string;
  name: string;
  billing_unit: "per_second" | "per_minute" | "per_hour";
  rate_inr_equivalent: string;
  base_fee_inr: string;
  minimum_charge_inr: string;
  maximum_cap_inr: string | null;
  grace_period_seconds: number;
  is_active: boolean;
};

type Venue = { id: string; name: string };

const BILLING_UNITS = ["per_second", "per_minute", "per_hour"] as const;

const defaultForm = {
  name: "",
  billingUnit: "per_minute" as const,
  rateCrypto: "0.000001",
  rateInrEquivalent: "2.00",
  baseFeeInr: "0",
  minimumChargeInr: "5",
  maximumCapInr: "",
  gracePeriodSeconds: 60
};

export const MerchantPricingPage = () => {
  const qc = useQueryClient();
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [status, setStatus] = useState<string | null>(null);

  const { data: venues = [] } = useQuery({
    queryKey: ["merchant-venues"],
    queryFn: () => apiFetch<Venue[]>("/merchants/me/venues")
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["pricing-plans", selectedVenueId],
    queryFn: () => apiFetch<PricingPlan[]>(`/venues/${selectedVenueId}/pricing`),
    enabled: !!selectedVenueId
  });

  const createPlan = useMutation({
    mutationFn: () =>
      apiFetch(`/venues/${selectedVenueId}/pricing`, {
        method: "POST",
        body: JSON.stringify({
          ...form,
          maximumCapInr: form.maximumCapInr ? Number(form.maximumCapInr) : null
        })
      }),
    onSuccess: () => {
      setStatus("✅ Pricing plan created!");
      setForm(defaultForm);
      void qc.invalidateQueries({ queryKey: ["pricing-plans", selectedVenueId] });
    },
    onError: (e: Error) => setStatus(`❌ ${e.message}`)
  });

  const toggleActive = useMutation({
    mutationFn: ({ planId, active }: { planId: string; active: boolean }) =>
      apiFetch(`/pricing/${planId}`, {
        method: "PUT",
        body: JSON.stringify({ isActive: active })
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["pricing-plans", selectedVenueId] })
  });

  const field = (label: string, key: keyof typeof form, type = "text") => (
    <div key={key}>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.25em] text-ink/55">{label}</label>
      <input
        type={type}
        value={String(form[key])}
        onChange={(e) => setForm((f) => ({ ...f, [key]: type === "number" ? Number(e.target.value) : e.target.value }))}
        className="w-full rounded-2xl border border-white/40 bg-white/55 px-4 py-3 text-sm outline-none focus:border-violet"
      />
    </div>
  );

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
      {/* Form */}
      <section className="glass-panel rounded-[32px] p-6">
        <p className="text-sm uppercase tracking-[0.35em] text-ink/55">Manage pricing</p>
        <h2 className="mt-2 text-3xl font-semibold">Pricing Plans</h2>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.25em] text-ink/55">Venue</label>
          <select
            value={selectedVenueId ?? ""}
            onChange={(e) => setSelectedVenueId(e.target.value || null)}
            className="w-full rounded-2xl border border-white/40 bg-white/55 px-4 py-3 text-sm outline-none"
          >
            <option value="">Select venue…</option>
            {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>

        {selectedVenueId && (
          <div className="mt-5 space-y-3">
            {field("Plan name", "name")}

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.25em] text-ink/55">Billing unit</label>
              <select
                value={form.billingUnit}
                onChange={(e) => setForm((f) => ({ ...f, billingUnit: e.target.value as typeof f.billingUnit }))}
                className="w-full rounded-2xl border border-white/40 bg-white/55 px-4 py-3 text-sm outline-none"
              >
                {BILLING_UNITS.map((u) => <option key={u} value={u}>{u.replace("_", " ")}</option>)}
              </select>
            </div>

            {field("Rate (INR equivalent)", "rateInrEquivalent")}
            {field("Base fee (INR)", "baseFeeInr")}
            {field("Minimum charge (INR)", "minimumChargeInr")}
            {field("Maximum cap (INR, optional)", "maximumCapInr")}
            {field("Grace period (seconds)", "gracePeriodSeconds", "number")}

            <button
              onClick={() => createPlan.mutate()}
              disabled={createPlan.isPending}
              className="mt-2 w-full rounded-full bg-blush py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {createPlan.isPending ? "Saving…" : "Create plan"}
            </button>

            {status && (
              <p className={`text-sm ${status.startsWith("✅") ? "text-emerald-600" : "text-red-500"}`}>{status}</p>
            )}
          </div>
        )}
      </section>

      {/* Plans list */}
      <section className="glass-panel rounded-[32px] p-6">
        <h3 className="text-xl font-semibold">
          {selectedVenueId ? `Plans for venue` : "Select a venue to view plans"}
        </h3>
        <div className="mt-5 space-y-3">
          {plans.map((plan) => (
            <article key={plan.id} className="rounded-[22px] bg-white/55 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-ink">{plan.name}</p>
                  <p className="mt-1 text-sm text-ink/65">
                    ₹{plan.rate_inr_equivalent} / {plan.billing_unit.replace("_", " ")}
                  </p>
                  <p className="mt-0.5 text-xs text-ink/50">
                    Min ₹{plan.minimum_charge_inr} · Base ₹{plan.base_fee_inr} · Grace {plan.grace_period_seconds}s
                    {plan.maximum_cap_inr ? ` · Cap ₹${plan.maximum_cap_inr}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => toggleActive.mutate({ planId: plan.id, active: !plan.is_active })}
                  className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                    plan.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {plan.is_active ? "Active" : "Inactive"}
                </button>
              </div>
            </article>
          ))}
          {selectedVenueId && plans.length === 0 && (
            <p className="text-sm text-ink/55">No pricing plans yet. Create one →</p>
          )}
        </div>
      </section>
    </div>
  );
};
