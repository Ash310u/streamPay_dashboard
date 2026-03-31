import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../index";

type MerchantTaxAssistantState = {
  question: string;
  financialYear: string;
};

const initialState: MerchantTaxAssistantState = {
  question: "What is my GST liability this quarter?",
  financialYear: "2025-2026",
};

const merchantTaxAssistantSlice = createSlice({
  name: "merchantTaxAssistant",
  initialState,
  reducers: {
    setMerchantTaxQuestion(state, action: PayloadAction<string>) {
      state.question = action.payload;
    },
    setMerchantTaxFinancialYear(state, action: PayloadAction<string>) {
      state.financialYear = action.payload;
    },
  },
});

export const { setMerchantTaxQuestion, setMerchantTaxFinancialYear } = merchantTaxAssistantSlice.actions;

export const merchantTaxAssistantReducer = merchantTaxAssistantSlice.reducer;

export const selectMerchantTaxAssistant = (state: RootState) => state.merchantTaxAssistant;
