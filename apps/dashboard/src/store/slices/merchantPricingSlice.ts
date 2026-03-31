import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../index";

export type MerchantPricingForm = {
  name: string;
  billingUnit: "per_second" | "per_minute" | "per_hour";
  rateCrypto: string;
  rateInrEquivalent: string;
  baseFeeInr: string;
  minimumChargeInr: string;
  maximumCapInr: string;
  gracePeriodSeconds: number;
};

export type MerchantPricingPlan = {
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

const defaultPricingForm: MerchantPricingForm = {
  name: "",
  billingUnit: "per_minute",
  rateCrypto: "0.000001",
  rateInrEquivalent: "2.00",
  baseFeeInr: "0",
  minimumChargeInr: "5",
  maximumCapInr: "",
  gracePeriodSeconds: 60,
};

type MerchantPricingState = {
  selectedVenueId: string | null;
  form: MerchantPricingForm;
  status: string | null;
  editingPlan: MerchantPricingPlan | null;
  editForm: MerchantPricingForm;
  previewSeconds: number;
  previewPlanId: string | null;
};

const initialState: MerchantPricingState = {
  selectedVenueId: null,
  form: defaultPricingForm,
  status: null,
  editingPlan: null,
  editForm: defaultPricingForm,
  previewSeconds: 600,
  previewPlanId: null,
};

const merchantPricingSlice = createSlice({
  name: "merchantPricing",
  initialState,
  reducers: {
    setMerchantPricingVenueId(state, action: PayloadAction<string | null>) {
      state.selectedVenueId = action.payload;
      state.editingPlan = null;
      state.editForm = defaultPricingForm;
      state.previewPlanId = null;
      state.status = null;
    },
    setMerchantPricingStatus(state, action: PayloadAction<string | null>) {
      state.status = action.payload;
    },
    setMerchantPricingFormField(
      state,
      action: PayloadAction<{ field: keyof MerchantPricingForm; value: MerchantPricingForm[keyof MerchantPricingForm] }>
    ) {
      state.form[action.payload.field] = action.payload.value as never;
    },
    resetMerchantPricingForm(state) {
      state.form = defaultPricingForm;
    },
    startEditingMerchantPricingPlan(state, action: PayloadAction<MerchantPricingPlan>) {
      const plan = action.payload;
      state.editingPlan = plan;
      state.editForm = {
        name: plan.name,
        billingUnit: plan.billing_unit,
        rateCrypto: plan.rate_crypto,
        rateInrEquivalent: plan.rate_inr_equivalent,
        baseFeeInr: plan.base_fee_inr,
        minimumChargeInr: plan.minimum_charge_inr,
        maximumCapInr: plan.maximum_cap_inr ?? "",
        gracePeriodSeconds: plan.grace_period_seconds,
      };
    },
    stopEditingMerchantPricingPlan(state) {
      state.editingPlan = null;
      state.editForm = defaultPricingForm;
    },
    setMerchantPricingEditFormField(
      state,
      action: PayloadAction<{ field: keyof MerchantPricingForm; value: MerchantPricingForm[keyof MerchantPricingForm] }>
    ) {
      state.editForm[action.payload.field] = action.payload.value as never;
    },
    setMerchantPricingPreviewSeconds(state, action: PayloadAction<number>) {
      state.previewSeconds = action.payload;
    },
    setMerchantPricingPreviewPlanId(state, action: PayloadAction<string | null>) {
      state.previewPlanId = action.payload;
    },
  },
});

export const {
  setMerchantPricingVenueId,
  setMerchantPricingStatus,
  setMerchantPricingFormField,
  resetMerchantPricingForm,
  startEditingMerchantPricingPlan,
  stopEditingMerchantPricingPlan,
  setMerchantPricingEditFormField,
  setMerchantPricingPreviewSeconds,
  setMerchantPricingPreviewPlanId,
} = merchantPricingSlice.actions;

export const merchantPricingReducer = merchantPricingSlice.reducer;

export const selectMerchantPricing = (state: RootState) => state.merchantPricing;
