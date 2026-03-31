import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../index";

type CustomerVenuesState = {
  selectedVenueId: string | null;
  cityFilter: string;
};

const initialState: CustomerVenuesState = {
  selectedVenueId: null,
  cityFilter: "",
};

const customerVenuesSlice = createSlice({
  name: "customerVenues",
  initialState,
  reducers: {
    setCustomerVenueCityFilter(state, action: PayloadAction<string>) {
      state.cityFilter = action.payload;
      state.selectedVenueId = null;
    },
    toggleCustomerVenueSelection(state, action: PayloadAction<string>) {
      state.selectedVenueId = state.selectedVenueId === action.payload ? null : action.payload;
    },
  },
});

export const { setCustomerVenueCityFilter, toggleCustomerVenueSelection } = customerVenuesSlice.actions;

export const customerVenuesReducer = customerVenuesSlice.reducer;

export const selectCustomerVenues = (state: RootState) => state.customerVenues;
