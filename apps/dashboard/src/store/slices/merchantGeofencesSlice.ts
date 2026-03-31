import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../index";

export type MerchantGeofence = {
  id: string;
  type: "circle" | "polygon";
  center_lat: number | null;
  center_lng: number | null;
  radius_meters: number | null;
  polygon_coordinates: Array<[number, number]> | null;
  created_at: string;
};

type CircleForm = {
  centerLat: string;
  centerLng: string;
  radiusMeters: string;
};

type MerchantGeofencesState = {
  selectedVenueId: string | null;
  mode: "circle" | "polygon";
  circle: CircleForm;
  polygonText: string;
  feedback: string | null;
  editingGeofence: MerchantGeofence | null;
  editCircle: CircleForm;
  editPolygonText: string;
};

const defaultPolygon = "12.9716,77.5946\n12.9719,77.5956\n12.9709,77.5952";

const initialState: MerchantGeofencesState = {
  selectedVenueId: null,
  mode: "circle",
  circle: { centerLat: "12.9716", centerLng: "77.5946", radiusMeters: "120" },
  polygonText: defaultPolygon,
  feedback: null,
  editingGeofence: null,
  editCircle: { centerLat: "", centerLng: "", radiusMeters: "" },
  editPolygonText: "",
};

const merchantGeofencesSlice = createSlice({
  name: "merchantGeofences",
  initialState,
  reducers: {
    setMerchantGeofenceVenueId(state, action: PayloadAction<string | null>) {
      state.selectedVenueId = action.payload;
      state.feedback = null;
      state.editingGeofence = null;
      state.editPolygonText = "";
      state.editCircle = { centerLat: "", centerLng: "", radiusMeters: "" };
    },
    setMerchantGeofenceMode(state, action: PayloadAction<"circle" | "polygon">) {
      state.mode = action.payload;
    },
    setMerchantGeofenceCircleField(
      state,
      action: PayloadAction<{ field: keyof CircleForm; value: CircleForm[keyof CircleForm] }>
    ) {
      state.circle[action.payload.field] = action.payload.value as never;
    },
    setMerchantGeofencePolygonText(state, action: PayloadAction<string>) {
      state.polygonText = action.payload;
    },
    setMerchantGeofenceFeedback(state, action: PayloadAction<string | null>) {
      state.feedback = action.payload;
    },
    startEditingMerchantGeofence(state, action: PayloadAction<MerchantGeofence>) {
      const geofence = action.payload;
      state.editingGeofence = geofence;

      if (geofence.type === "circle") {
        state.editCircle = {
          centerLat: String(geofence.center_lat ?? 0),
          centerLng: String(geofence.center_lng ?? 0),
          radiusMeters: String(geofence.radius_meters ?? 100),
        };
        state.editPolygonText = "";
        return;
      }

      state.editPolygonText = (geofence.polygon_coordinates ?? [])
        .map(([lat, lng]) => `${lat},${lng}`)
        .join("\n");
      state.editCircle = { centerLat: "", centerLng: "", radiusMeters: "" };
    },
    stopEditingMerchantGeofence(state) {
      state.editingGeofence = null;
      state.editCircle = { centerLat: "", centerLng: "", radiusMeters: "" };
      state.editPolygonText = "";
    },
    setMerchantGeofenceEditCircleField(
      state,
      action: PayloadAction<{ field: keyof CircleForm; value: CircleForm[keyof CircleForm] }>
    ) {
      state.editCircle[action.payload.field] = action.payload.value as never;
    },
    setMerchantGeofenceEditPolygonText(state, action: PayloadAction<string>) {
      state.editPolygonText = action.payload;
    },
  },
});

export const {
  setMerchantGeofenceVenueId,
  setMerchantGeofenceMode,
  setMerchantGeofenceCircleField,
  setMerchantGeofencePolygonText,
  setMerchantGeofenceFeedback,
  startEditingMerchantGeofence,
  stopEditingMerchantGeofence,
  setMerchantGeofenceEditCircleField,
  setMerchantGeofenceEditPolygonText,
} = merchantGeofencesSlice.actions;

export const merchantGeofencesReducer = merchantGeofencesSlice.reducer;

export const selectMerchantGeofences = (state: RootState) => state.merchantGeofences;
