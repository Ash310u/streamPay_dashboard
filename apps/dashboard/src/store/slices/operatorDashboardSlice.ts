import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../index";

export type OperatorDashboardTab = "overview" | "ledger" | "sessions";

type OperatorDashboardState = {
  tab: OperatorDashboardTab;
  exportStatus: string | null;
};

const initialState: OperatorDashboardState = {
  tab: "overview",
  exportStatus: null,
};

const operatorDashboardSlice = createSlice({
  name: "operatorDashboard",
  initialState,
  reducers: {
    setOperatorDashboardTab(state, action: PayloadAction<OperatorDashboardTab>) {
      state.tab = action.payload;
    },
    setOperatorDashboardExportStatus(state, action: PayloadAction<string | null>) {
      state.exportStatus = action.payload;
    },
  },
});

export const { setOperatorDashboardTab, setOperatorDashboardExportStatus } = operatorDashboardSlice.actions;

export const operatorDashboardReducer = operatorDashboardSlice.reducer;

export const selectOperatorDashboard = (state: RootState) => state.operatorDashboard;
