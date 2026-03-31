import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../index";

type MerchantDashboardState = {
  qrMessage: string | null;
  exportStatus: string | null;
};

const initialState: MerchantDashboardState = {
  qrMessage: null,
  exportStatus: null,
};

const merchantDashboardSlice = createSlice({
  name: "merchantDashboard",
  initialState,
  reducers: {
    setMerchantDashboardQrMessage(state, action: PayloadAction<string | null>) {
      state.qrMessage = action.payload;
    },
    setMerchantDashboardExportStatus(state, action: PayloadAction<string | null>) {
      state.exportStatus = action.payload;
    },
  },
});

export const { setMerchantDashboardQrMessage, setMerchantDashboardExportStatus } = merchantDashboardSlice.actions;

export const merchantDashboardReducer = merchantDashboardSlice.reducer;

export const selectMerchantDashboard = (state: RootState) => state.merchantDashboard;
