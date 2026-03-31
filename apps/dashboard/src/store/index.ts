import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { apiSlice } from './api';
import { authReducer } from './slices/authSlice';
import { customerDashboardReducer } from './slices/customerDashboardSlice';
import { customerVenuesReducer } from './slices/customerVenuesSlice';
import { merchantDashboardReducer } from './slices/merchantDashboardSlice';
import { merchantGeofencesReducer } from './slices/merchantGeofencesSlice';
import { merchantLiveSessionsReducer } from './slices/merchantLiveSessionsSlice';
import { merchantPricingReducer } from './slices/merchantPricingSlice';
import { merchantTaxAssistantReducer } from './slices/merchantTaxAssistantSlice';
import { merchantVenuesReducer } from './slices/merchantVenuesSlice';
import { operatorDashboardReducer } from './slices/operatorDashboardSlice';
import { operatorSettlementsReducer } from './slices/operatorSettlementsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    customerDashboard: customerDashboardReducer,
    customerVenues: customerVenuesReducer,
    merchantDashboard: merchantDashboardReducer,
    merchantGeofences: merchantGeofencesReducer,
    merchantLiveSessions: merchantLiveSessionsReducer,
    merchantPricing: merchantPricingReducer,
    merchantTaxAssistant: merchantTaxAssistantReducer,
    merchantVenues: merchantVenuesReducer,
    operatorDashboard: operatorDashboardReducer,
    operatorSettlements: operatorSettlementsReducer,
    [apiSlice.reducerPath]: apiSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(apiSlice.middleware),
});

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export type AppStore = typeof store;

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
export const useAppStore = useStore.withTypes<AppStore>();
