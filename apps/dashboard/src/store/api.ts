import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { supabase } from '../lib/supabase';
export type AuthSession = { session: Record<string, unknown>; user: Record<string, unknown> };
export type RegisterResult = { userId: string; role: string };

export type Profile = {
  id: string;
  full_name: string;
  phone: string;
  wallet_address: string;
  role: string;
  kyc_status: string;
  created_at: string;
  updated_at: string;
};

export type WalletTransaction = {
  id: string;
  wallet_id: string;
  type: string;
  inr_amount: number;
  crypto_amount: number;
  exchange_rate: number;
  status: string;
  created_at: string;
  razorpay_payment_id?: string;
};

export type SessionReconcile = {
  activeSession: Record<string, unknown> | null;
  currentCharge?: number;
  elapsedSeconds?: number;
  lockedRate?: number;
  billingUnit?: string;
};

export type BillingPreview = {
  elapsedSeconds: number;
  grossInr: number;
  cryptoAmount: number;
  platformFeeInr: number;
  merchantPayoutInr: number;
};

export type Merchant = {
  id: string;
  business_name: string;
  business_type: string;
  gstin: string;
  pan_number: string;
  bank_account_number: string;
  bank_ifsc: string;
  bank_account_name: string;
  upi_id: string;
  settlement_status: string;
  onboarded_at: string;
};

export type CustomerOverviewRow = {
  created_at: string;
  inr_equivalent: number;
  duration_seconds: number;
  venues?: { name?: string };
};

export type MerchantSessionRow = {
  id: string;
  user_id: string;
  venue_id: string;
  status: string;
  entry_time: string;
  exit_time: string | null;
  inr_equivalent: number;
  crypto_charged: number;
  trigger_mode: string;
};

const API_URL = import.meta.env.VITE_API_URL;

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: API_URL,
    prepareHeaders: async (headers, { endpoint }) => {
      // Skip session check for auth endpoints to prevent hangs on startup or during login
      if (endpoint === 'login' || endpoint === 'register' || endpoint === 'web3Login') {
        return headers;
      }

      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['Profile', 'Wallet', 'Session', 'Merchant', 'Geofence', 'Analytics'],
  endpoints: (builder) => ({
    // Auth
    register: builder.mutation<RegisterResult, { email: string; password: string; fullName: string; phone?: string }>({
      query: (body) => ({
        url: '/auth/register',
        method: 'POST',
        body,
      }),
    }),
    login: builder.mutation<AuthSession, { email: string; password: string }>({
      query: (body) => ({
        url: '/auth/login',
        method: 'POST',
        body,
      }),
    }),
    logout: builder.mutation<void, void>({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
      }),
    }),
    web3Login: builder.mutation<AuthSession, { email: string; walletAddress: string; idToken?: string; appPublicKey?: string }>({
      query: (body) => ({
        url: '/auth/web3-login',
        method: 'POST',
        body,
      }),
    }),
    kycUpload: builder.mutation<{ kycStatus: string; message: string }, any>({
      query: (body) => ({
        url: '/auth/kyc/upload',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Profile', 'Merchant'],
    }),

    // Users
    getProfile: builder.query<Profile, void>({
      query: () => '/users/me',
      providesTags: ['Profile'],
    }),

    // Wallet
    getWalletTransactions: builder.query<WalletTransaction[], void>({
      query: () => '/wallet/transactions',
      providesTags: ['Wallet'],
    }),
    getWalletBalance: builder.query<any, void>({
      query: () => '/wallet/balance',
      providesTags: ['Wallet'],
    }),
    topupOrder: builder.mutation<any, { amountInr: number }>({
      query: (body) => ({
        url: '/wallet/topup/order',
        method: 'POST',
        body,
      }),
    }),
    topupVerify: builder.mutation<any, { amountInr: number; paymentId: string }>({
      query: (body) => ({
        url: '/wallet/topup/verify',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Wallet'],
    }),

    // Venues
    getVenues: builder.query<any[], string | void>({
      query: (city) => city ? `/venues?city=${encodeURIComponent(city)}` : '/venues',
    }),
    getVenue: builder.query<any, string>({
      query: (id) => `/venues/${id}`,
    }),
    createVenue: builder.mutation<any, any>({
      query: (body) => ({
        url: '/venues',
        method: 'POST',
        body,
      }),
    }),
    updateVenue: builder.mutation<any, { id: string; body: any }>({
      query: ({ id, body }) => ({
        url: `/venues/${id}`,
        method: 'PUT',
        body,
      }),
    }),
    deleteVenue: builder.mutation<any, string>({
      query: (id) => ({
        url: `/venues/${id}`,
        method: 'DELETE',
      }),
    }),
    generateVenueQr: builder.mutation<any, { venueId: string; type: string }>({
      query: ({ venueId, type }) => ({
        url: `/venues/${venueId}/qr/generate?type=${type}`,
        method: 'POST',
      }),
    }),
    getVenueGeofences: builder.query<any[], string>({
      query: (id) => `/venues/${id}/geofences`,
    }),
    createGeofence: builder.mutation<any, { venueId: string; body: any }>({
      query: ({ venueId, body }) => ({
        url: `/venues/${venueId}/geofences`,
        method: 'POST',
        body,
      }),
    }),
    deleteGeofence: builder.mutation<any, string>({
      query: (id) => ({
        url: `/geofences/${id}`,
        method: 'DELETE',
      }),
    }),
    getVenueQrCodes: builder.query<any[], string>({
      query: (id) => `/venues/${id}/qr`,
    }),
    getVenuePricing: builder.query<any[], string>({
      query: (id) => `/venues/${id}/pricing`,
    }),
    createVenuePricing: builder.mutation<any, { venueId: string; body: any }>({
      query: ({ venueId, body }) => ({
        url: `/venues/${venueId}/pricing`,
        method: 'POST',
        body,
      }),
    }),
    updateVenuePricing: builder.mutation<any, { id: string; body: any }>({
      query: ({ id, body }) => ({
        url: `/pricing/${id}`,
        method: 'PUT',
        body,
      }),
    }),
    deleteVenuePricing: builder.mutation<any, string>({
      query: (id) => ({
        url: `/pricing/${id}`,
        method: 'DELETE',
      }),
    }),

    // Sessions
    getCustomerSessions: builder.query<any[], void>({
      query: () => '/users/me/sessions',
      providesTags: ['Session'],
    }),
    getActiveSession: builder.query<any, void>({
      query: () => '/sessions/active',
      providesTags: ['Session'],
    }),
    getActiveSessionCharge: builder.query<any, string>({
      query: (id) => `/sessions/${id}/charge`,
    }),
    getReceipt: builder.query<any, string>({
      query: (id) => `/billing/receipts/${id}`,
    }),
    checkoutSession: builder.mutation<any, string>({
      query: (id) => ({
        url: `/sessions/${id}/checkout`,
        method: 'POST',
      }),
      invalidatesTags: ['Session', 'Wallet'],
    }),
    disputeSession: builder.mutation<any, { sessionId: string; reason: string }>({
      query: ({ sessionId, reason }) => ({
        url: `/sessions/${sessionId}/dispute`,
        method: 'POST',
        body: { reason },
      }),
      invalidatesTags: ['Session'],
    }),
    reconcileSession: builder.query<SessionReconcile, void>({
      query: () => '/sessions/active/reconcile',
      providesTags: ['Session'],
    }),
    resumeSession: builder.mutation<Record<string, unknown>, string>({
      query: (id) => ({
        url: `/sessions/${id}/resume`,
        method: 'POST',
      }),
      invalidatesTags: ['Session'],
    }),
    closeSession: builder.mutation<Record<string, unknown>, string>({
      query: (id) => ({
        url: `/sessions/${id}/close`,
        method: 'POST',
      }),
      invalidatesTags: ['Session'],
    }),
    refundSession: builder.mutation<any, string>({
      query: (id) => ({
        url: `/admin/sessions/${id}/refund`,
        method: 'POST',
      }),
    }),
    getSession: builder.query<Record<string, unknown>, string>({
      query: (id) => `/sessions/${id}`,
      providesTags: ['Session'],
    }),

    // Merchants
    getMerchant: builder.query<Merchant, void>({
      query: () => '/merchants/me',
      providesTags: ['Merchant'],
    }),
    onboardMerchant: builder.mutation<Merchant, any>({
      query: (body) => ({
        url: '/merchants/onboard',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Merchant', 'Profile'],
    }),
    getMerchantTaxSummary: builder.query<Record<string, unknown>, string | void>({
      query: (financialYear) => `/merchants/me/tax-summary${financialYear ? `?financialYear=${financialYear}` : ''}`,
    }),
    askTaxAssistant: builder.mutation<any, { question: string; financialYear: string }>({
      query: (body) => ({
        url: `/tax/chat`,
        method: 'POST',
        body,
      }),
    }),
    generateTaxPdf: builder.mutation<any, string>({
      query: (financialYear) => ({
        url: `/tax/summary/generate-pdf`,
        method: 'POST',
        body: { financialYear },
      }),
    }),
    getBillingPreview: builder.query<BillingPreview, Record<string, any>>({
      query: (params) => ({
        url: '/billing/preview',
        params,
      }),
    }),
    updateGeofence: builder.mutation<any, { id: string; body: any }>({
      query: ({ id, body }) => ({
        url: `/geofences/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Geofence'],
    }),
    getMerchantSettlements: builder.query<any[], void>({
      query: () => '/merchants/me/settlements',
    }),
    getMerchantVenues: builder.query<any[], void>({
      query: () => '/merchants/me/venues',
    }),

    // Analytics
    getCustomerOverview: builder.query<CustomerOverviewRow[], void>({
      query: () => '/analytics/customer-overview',
      providesTags: ['Analytics'],
    }),
    getMerchantSessions: builder.query<MerchantSessionRow[], string | void>({
      query: (status) => `/analytics/merchant-sessions${status ? `?status=${status}` : ''}`,
      providesTags: ['Analytics'],
    }),
    getMerchantStats: builder.query<any, void>({
      query: () => '/merchants/me/analytics',
    }),
    getMerchantRevenue: builder.query<any[], void>({
      query: () => '/analytics/revenue',
    }),
    getMerchantOccupancy: builder.query<any[], void>({
      query: () => '/analytics/occupancy',
    }),
    exportMerchantRevenue: builder.query<string, void>({
      query: () => ({
        url: '/analytics/export',
        responseHandler: (response) => response.text(),
      }),
    }),

    // Notifications
    getCustomerNotifications: builder.query<any[], void>({
      query: () => '/users/me/notifications',
    }),
    markNotificationRead: builder.mutation<any, string>({
      query: (id) => ({
        url: `/notifications/${id}/read`,
        method: 'PUT',
      }),
    }),

    // Admin
    getAdminMerchants: builder.query<Merchant[], void>({
      query: () => '/admin/merchants',
      providesTags: ['Merchant'],
    }),
    getAdminLedger: builder.query<Record<string, unknown>[], void>({
      query: () => '/admin/operator/ledger',
    }),
    getAdminSessions: builder.query<Record<string, unknown>[], void>({
      query: () => '/admin/operator/sessions',
    }),
    exportOperatorLedger: builder.query<string, void>({
      query: () => ({
        url: '/admin/operator/export/ledger',
        responseHandler: (response) => response.text(),
      }),
    }),
    runAdminSettlement: builder.mutation<{ batchDate: string; result: Record<string, unknown> }, string>({
      query: (batchDate) => ({
        url: '/admin/settlements/run',
        method: 'POST',
        body: { batchDate },
      }),
    }),
    getOperatorStats: builder.query<any, void>({
      query: () => '/admin/operator/stats',
    }),
    getOperatorRevenue: builder.query<any[], void>({
      query: () => '/admin/operator/revenue',
    }),
    getOperatorLive: builder.query<any[], void>({
      query: () => '/admin/operator/live',
    }),
    getOperatorSettlements: builder.query<any[], void>({
      query: () => '/admin/operator/settlements',
    }),
    retryOperatorSettlement: builder.mutation<any, string>({
      query: (id) => ({
        url: `/admin/operator/settlements/${id}/retry`,
        method: 'POST',
      }),
    }),
    getOperatorMerchants: builder.query<any[], void>({
      query: () => '/admin/operator/merchants',
    }),
    verifyMerchant: builder.mutation<any, string>({
      query: (id) => ({
        url: `/admin/merchants/${id}/verify`,
        method: 'PUT',
      }),
    }),
    suspendMerchant: builder.mutation<any, string>({
      query: (id) => ({
        url: `/admin/merchants/${id}/suspend`,
        method: 'PUT',
      }),
    }),
    reactivateMerchant: builder.mutation<any, string>({
      query: (id) => ({
        url: `/admin/merchants/${id}/reactivate`,
        method: 'PUT',
      }),
    }),
    getOperatorAnalytics: builder.query<any, void>({
      query: () => '/analytics/operator',
    }),
  }),
});

export const {
  useRegisterMutation,
  useLoginMutation,
  useLogoutMutation,
  useWeb3LoginMutation,
  useKycUploadMutation,

  useGetProfileQuery,
  useGetWalletTransactionsQuery,
  useGetWalletBalanceQuery,
  useTopupOrderMutation,
  useTopupVerifyMutation,

  useGetVenuesQuery,
  useGetVenueQuery,
  useCreateVenueMutation,
  useUpdateVenueMutation,
  useDeleteVenueMutation,
  useGenerateVenueQrMutation,
  useGetVenueGeofencesQuery,
  useCreateGeofenceMutation,
  useDeleteGeofenceMutation,
  useGetVenueQrCodesQuery,
  useGetVenuePricingQuery,
  useCreateVenuePricingMutation,
  useUpdateVenuePricingMutation,
  useDeleteVenuePricingMutation,

  useGetCustomerSessionsQuery,
  useGetActiveSessionQuery,
  useGetActiveSessionChargeQuery,
  useGetReceiptQuery,
  useLazyGetReceiptQuery,
  useCheckoutSessionMutation,
  useDisputeSessionMutation,

  useReconcileSessionQuery,
  useResumeSessionMutation,
  useCloseSessionMutation,
  useRefundSessionMutation,
  useGetSessionQuery,

  useGetMerchantQuery,
  useOnboardMerchantMutation,
  useGetMerchantTaxSummaryQuery,
  useAskTaxAssistantMutation,
  useGenerateTaxPdfMutation,
  useGetBillingPreviewQuery,
  useLazyGetBillingPreviewQuery,
  useUpdateGeofenceMutation,
  useGetMerchantSettlementsQuery,
  useGetMerchantVenuesQuery,
  useGetMerchantStatsQuery,
  useGetMerchantRevenueQuery,
  useGetMerchantOccupancyQuery,

  useGetCustomerOverviewQuery,
  useGetCustomerNotificationsQuery,
  useMarkNotificationReadMutation,
  useGetMerchantSessionsQuery,
  useLazyExportMerchantRevenueQuery,

  useGetAdminMerchantsQuery,
  useGetAdminLedgerQuery,
  useGetAdminSessionsQuery,
  useRunAdminSettlementMutation,
  useGetOperatorStatsQuery,
  useGetOperatorRevenueQuery,
  useGetOperatorLiveQuery,
  useGetOperatorSettlementsQuery,
  useRetryOperatorSettlementMutation,
  useGetOperatorMerchantsQuery,
  useVerifyMerchantMutation,
  useSuspendMerchantMutation,
  useReactivateMerchantMutation,
  useGetOperatorAnalyticsQuery,
  useLazyExportOperatorLedgerQuery,
} = apiSlice;
