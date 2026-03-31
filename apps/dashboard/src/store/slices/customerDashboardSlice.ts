import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../index";

export type CustomerDashboardTab = "sessions" | "transactions" | "overview";

type CustomerDashboardState = {
  tab: CustomerDashboardTab;
  disputeSessionId: string | null;
  disputeReason: string;
  isTopUpLoading: boolean;
};

const initialState: CustomerDashboardState = {
  tab: "sessions",
  disputeSessionId: null,
  disputeReason: "",
  isTopUpLoading: false,
};

const customerDashboardSlice = createSlice({
  name: "customerDashboard",
  initialState,
  reducers: {
    setCustomerDashboardTab(state, action: PayloadAction<CustomerDashboardTab>) {
      state.tab = action.payload;
    },
    openCustomerDispute(state, action: PayloadAction<string>) {
      state.disputeSessionId = action.payload;
      state.disputeReason = "";
    },
    closeCustomerDispute(state) {
      state.disputeSessionId = null;
      state.disputeReason = "";
    },
    setCustomerDisputeReason(state, action: PayloadAction<string>) {
      state.disputeReason = action.payload;
    },
    setCustomerTopUpLoading(state, action: PayloadAction<boolean>) {
      state.isTopUpLoading = action.payload;
    },
  },
});

export const {
  setCustomerDashboardTab,
  openCustomerDispute,
  closeCustomerDispute,
  setCustomerDisputeReason,
  setCustomerTopUpLoading,
} = customerDashboardSlice.actions;

export const customerDashboardReducer = customerDashboardSlice.reducer;

export const selectCustomerDashboard = (state: RootState) => state.customerDashboard;
