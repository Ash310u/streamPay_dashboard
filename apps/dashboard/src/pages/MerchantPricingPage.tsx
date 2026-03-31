import { useState } from "react";
import {
  useGetMerchantVenuesQuery,
  useGetVenuePricingQuery,
  useCreateVenuePricingMutation,
  useUpdateVenuePricingMutation,
  useLazyGetBillingPreviewQuery,
  type BillingPreview
} from "../store/api";

type PricingPlan = {
  id: string;
  name: string;
  billing_unit: "per_second" | "per_minute" | "per_hour";
  rate_crypto: string;
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
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [status, setStatus] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState<PricingPlan | null>(null);
  const [editForm, setEditForm] = useState(defaultForm);
  const [previewSeconds, setPreviewSeconds] = useState(600);
  const [previewPlanId, setPreviewPlanId] = useState<string | null>(null);

  const [triggerPreview, { data: previewResult, isFetching: isPreviewFetching }] = useLazyGetBillingPreviewQuery();

  const { data: venues = [] } = useGetMerchantVenuesQuery();

  const { data: plans = [], isLoading: plansLoading } = useGetVenuePricingQuery(selectedVenueId ?? "", {
    skip: !selectedVenueId
  });

  const [createVenuePricing, { isLoading: isCreatePending }] = useCreateVenuePricingMutation();
  const [updateVenuePricing, { isLoading: isUpdatePending }] = useUpdateVenuePricingMutation();

  const handleCreatePlan = async () => {
    try {
      if (!selectedVenueId) return;
      await createVenuePricing({
        venueId: selectedVenueId,
        body: {
          ...form,
          maximumCapInr: form.maximumCapInr ? Number(form.maximumCapInr) : null
        }
      }).unwrap();
      setStatus("✅ Pricing plan created!");
      setForm(defaultForm);
    } catch (e: any) {
      setStatus(`❌ ${e?.data?.error || e?.message || "Failed"}`);
    }
  };

  const handleToggleActive = async (planId: string, active: boolean) => {
    try {
      await updateVenuePricing({
        id: planId,
        body: { isActive: active }
      }).unwrap();
    } catch {}
  };

  const handleUpdatePlan = async () => {
    if (!editingPlan) return;
    try {
      await updateVenuePricing({
        id: editingPlan.id,
        body: {
          name: editForm.name,
          billingUnit: editForm.billingUnit,
          rateCrypto: Number(editForm.rateCrypto),
          rateInrEquivalent: Number(editForm.rateInrEquivalent),
          baseFeeInr: Number(editForm.baseFeeInr),
          minimumChargeInr: Number(editForm.minimumChargeInr),
          maximumCapInr: editForm.maximumCapInr ? Number(editForm.maximumCapInr) : null,
          gracePeriodSeconds: Number(editForm.gracePeriodSeconds),
          isActive: editingPlan.is_active
        }
      }).unwrap();
      setEditingPlan(null);
      setStatus("✅ Plan updated!");
    } catch (e: any) {
      setStatus(`❌ ${e?.data?.error || e?.message || "Failed"}`);
    }
  };

  const fetchPreview = async (plan: PricingPlan) => {
    try {
      setPreviewPlanId(plan.id);
      await triggerPreview({
        elapsedSeconds: previewSeconds,
        billingUnit: plan.billing_unit,
        rateCrypto: plan.rate_crypto,
        lockedRate: plan.rate_inr_equivalent,
        minimumChargeInr: plan.minimum_charge_inr,
        maximumCapInr: plan.maximum_cap_inr ?? "",
        baseFeeInr: plan.base_fee_inr
      }).unwrap();
    } catch {
      // Error handled by query state
    }
  };

  const startEditPlan = (plan: PricingPlan) => {
    setEditingPlan(plan);
    setEditForm({
      name: plan.name,
      billingUnit: plan.billing_unit as any,
      rateCrypto: plan.rate_crypto,
      rateInrEquivalent: plan.rate_inr_equivalent,
      baseFeeInr: plan.base_fee_inr,
      minimumChargeInr: plan.minimum_charge_inr,
      maximumCapInr: plan.maximum_cap_inr ?? "",
      gracePeriodSeconds: plan.grace_period_seconds
    });
  };

  const inputClass = "w-full rounded-2xl border border-white/40 bg-white/55 px-4 py-3 text-sm outline-none focus:border-violet";

  const field = (label: string, key: keyof typeof defaultForm, formObj: typeof defaultForm, setFormFn: React.Dispatch<React.SetStateAction<typeof defaultForm>>, type = "text") => (
    <div key={key}>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.25em] text-ink/55">{label}</label>
      <input
        type={type}
        value={String(formObj[key])}
        onChange={(e) => setFormFn((f) => ({ ...f, [key]: type === "number" ? Number(e.target.value) : e.target.value }))}
        className={inputClass}
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
            onChange={(e) => { setSelectedVenueId(e.target.value || null); setEditingPlan(null); }}
            className={inputClass}
          >
            <option value="">Select venue…</option>
            {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>

        {selectedVenueId && !editingPlan && (
          <div className="mt-5 space-y-3">
            {field("Plan name", "name", form, setForm)}

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.25em] text-ink/55">Billing unit</label>
              <select
                value={form.billingUnit}
                onChange={(e) => setForm((f) => ({ ...f, billingUnit: e.target.value as typeof f.billingUnit }))}
                className={inputClass}
              >
                {BILLING_UNITS.map((u) => <option key={u} value={u}>{u.replace("_", " ")}</option>)}
              </select>
            </div>

            {field("Rate (crypto)", "rateCrypto", form, setForm)}
            {field("Rate (INR equivalent)", "rateInrEquivalent", form, setForm)}
            {field("Base fee (INR)", "baseFeeInr", form, setForm)}
            {field("Minimum charge (INR)", "minimumChargeInr", form, setForm)}
            {field("Maximum cap (INR, optional)", "maximumCapInr", form, setForm)}
            {field("Grace period (seconds)", "gracePeriodSeconds", form, setForm, "number")}

            <button
              onClick={() => void handleCreatePlan()}
              disabled={isCreatePending}
              className="mt-2 w-full rounded-full bg-blush py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {isCreatePending ? "Saving…" : "Create plan"}
            </button>

            {status && (
              <p className={`text-sm ${status.startsWith("✅") ? "text-emerald-600" : "text-red-500"}`}>{status}</p>
            )}
          </div>
        )}

        {editingPlan && (
          <div className="mt-5 space-y-3">
            <p className="text-sm font-semibold text-violet">Editing: {editingPlan.name}</p>
            {field("Plan name", "name", editForm, setEditForm)}
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.25em] text-ink/55">Billing unit</label>
              <select
                value={editForm.billingUnit}
                onChange={(e) => setEditForm((f) => ({ ...f, billingUnit: e.target.value as typeof f.billingUnit }))}
                className={inputClass}
              >
                {BILLING_UNITS.map((u) => <option key={u} value={u}>{u.replace("_", " ")}</option>)}
              </select>
            </div>
            {field("Rate (crypto)", "rateCrypto", editForm, setEditForm)}
            {field("Rate (INR equivalent)", "rateInrEquivalent", editForm, setEditForm)}
            {field("Base fee (INR)", "baseFeeInr", editForm, setEditForm)}
            {field("Minimum charge (INR)", "minimumChargeInr", editForm, setEditForm)}
            {field("Maximum cap (INR, optional)", "maximumCapInr", editForm, setEditForm)}
            {field("Grace period (seconds)", "gracePeriodSeconds", editForm, setEditForm, "number")}

            <div className="flex gap-2">
              <button
                onClick={() => void handleUpdatePlan()}
                disabled={isUpdatePending}
                className="rounded-full bg-violet px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
              >
                {isUpdatePending ? "Saving…" : "Save changes"}
              </button>
              <button
                onClick={() => setEditingPlan(null)}
                className="rounded-full bg-white/55 px-5 py-3 text-sm font-semibold text-ink"
              >
                Cancel
              </button>
            </div>

            {status && (
              <p className={`text-sm ${status.startsWith("✅") ? "text-emerald-600" : "text-red-500"}`}>{status}</p>
            )}
          </div>
        )}
      </section>

      {/* Plans list */}
      <section className="glass-panel rounded-[32px] p-6">
        <h3 className="text-xl font-semibold">
          {selectedVenueId ? "Plans for venue" : "Select a venue to view plans"}
        </h3>

        {plansLoading ? (
          <div className="mt-5 flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet border-t-transparent" />
          </div>
        ) : (
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
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEditPlan(plan)}
                      className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink transition hover:-translate-y-0.5"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => void handleToggleActive(plan.id, !plan.is_active)}
                      className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                        plan.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {plan.is_active ? "Active" : "Inactive"}
                    </button>
                  </div>
                </div>

                {/* Billing preview */}
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="number"
                    value={previewSeconds}
                    onChange={(e) => setPreviewSeconds(Number(e.target.value))}
                    className="w-24 rounded-xl border border-white/40 bg-white/70 px-3 py-1.5 text-xs outline-none"
                    placeholder="Seconds"
                  />
                  <button
                    onClick={() => void fetchPreview(plan)}
                    className="rounded-full bg-white/70 px-3 py-1.5 text-xs font-semibold text-ink transition hover:-translate-y-0.5"
                  >
                    Preview cost
                  </button>
                </div>
                {previewPlanId === plan.id && previewResult && (
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-xl bg-white/70 p-2 text-center">
                      <p className="text-ink/50">Gross</p>
                      <p className="font-semibold">₹{Number(previewResult.grossInr).toFixed(2)}</p>
                    </div>
                    <div className="rounded-xl bg-white/70 p-2 text-center">
                      <p className="text-ink/50">Merchant</p>
                      <p className="font-semibold">₹{Number(previewResult.merchantPayoutInr).toFixed(2)}</p>
                    </div>
                    <div className="rounded-xl bg-white/70 p-2 text-center">
                      <p className="text-ink/50">Fee</p>
                      <p className="font-semibold">₹{Number(previewResult.platformFeeInr).toFixed(2)}</p>
                    </div>
                  </div>
                )}
              </article>
            ))}
            {selectedVenueId && plans.length === 0 && (
              <p className="text-sm text-ink/55">No pricing plans yet. Create one →</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
