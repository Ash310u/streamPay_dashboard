import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../index";

export type MerchantLiveSessionsFilter = "all" | "active" | "closed";

type MerchantLiveSessionsState = {
  filter: MerchantLiveSessionsFilter;
};

const initialState: MerchantLiveSessionsState = {
  filter: "active",
};

const merchantLiveSessionsSlice = createSlice({
  name: "merchantLiveSessions",
  initialState,
  reducers: {
    setMerchantLiveSessionsFilter(state, action: PayloadAction<MerchantLiveSessionsFilter>) {
      state.filter = action.payload;
    },
  },
});

export const { setMerchantLiveSessionsFilter } = merchantLiveSessionsSlice.actions;

export const merchantLiveSessionsReducer = merchantLiveSessionsSlice.reducer;

export const selectMerchantLiveSessions = (state: RootState) => state.merchantLiveSessions;
