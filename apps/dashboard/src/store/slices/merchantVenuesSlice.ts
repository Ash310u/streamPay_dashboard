import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../index";

export type MerchantVenue = {
  id: string;
  name: string;
  city: string;
  address: string;
  category: string;
  description?: string;
  lat?: number;
  lng?: number;
};

export type MerchantVenueForm = {
  name: string;
  description: string;
  category: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
};

const defaultVenueForm: MerchantVenueForm = {
  name: "",
  description: "",
  category: "coworking",
  address: "",
  city: "",
  lat: 12.9716,
  lng: 77.5946,
};

const defaultEditVenueForm: MerchantVenueForm = {
  name: "",
  description: "",
  category: "",
  address: "",
  city: "",
  lat: 0,
  lng: 0,
};

type MerchantVenuesState = {
  form: MerchantVenueForm;
  editingVenue: MerchantVenue | null;
  editForm: MerchantVenueForm;
  deleteConfirmId: string | null;
};

const initialState: MerchantVenuesState = {
  form: defaultVenueForm,
  editingVenue: null,
  editForm: defaultEditVenueForm,
  deleteConfirmId: null,
};

const merchantVenuesSlice = createSlice({
  name: "merchantVenues",
  initialState,
  reducers: {
    setMerchantVenueFormField(
      state,
      action: PayloadAction<{ field: keyof MerchantVenueForm; value: MerchantVenueForm[keyof MerchantVenueForm] }>
    ) {
      state.form[action.payload.field] = action.payload.value as never;
    },
    resetMerchantVenueForm(state) {
      state.form = defaultVenueForm;
    },
    startEditingMerchantVenue(state, action: PayloadAction<MerchantVenue>) {
      const venue = action.payload;
      state.editingVenue = venue;
      state.editForm = {
        name: venue.name,
        description: venue.description ?? "",
        category: venue.category,
        address: venue.address,
        city: venue.city,
        lat: venue.lat ?? 12.9716,
        lng: venue.lng ?? 77.5946,
      };
    },
    stopEditingMerchantVenue(state) {
      state.editingVenue = null;
      state.editForm = defaultEditVenueForm;
    },
    setMerchantVenueEditField(
      state,
      action: PayloadAction<{ field: keyof MerchantVenueForm; value: MerchantVenueForm[keyof MerchantVenueForm] }>
    ) {
      state.editForm[action.payload.field] = action.payload.value as never;
    },
    setMerchantVenueDeleteConfirmId(state, action: PayloadAction<string | null>) {
      state.deleteConfirmId = action.payload;
    },
  },
});

export const {
  setMerchantVenueFormField,
  resetMerchantVenueForm,
  startEditingMerchantVenue,
  stopEditingMerchantVenue,
  setMerchantVenueEditField,
  setMerchantVenueDeleteConfirmId,
} = merchantVenuesSlice.actions;

export const merchantVenuesReducer = merchantVenuesSlice.reducer;

export const selectMerchantVenues = (state: RootState) => state.merchantVenues;
