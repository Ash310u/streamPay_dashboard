import { supabase } from "./supabase";

const API_URL = import.meta.env.VITE_API_URL;

export const getAccessToken = async () => {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
};

export const apiFetch = async <T>(path: string, init?: RequestInit): Promise<T> => {
  console.log(`[apiFetch] starting request to ${path}`);
  console.log(`[apiFetch] API_URL is:`, API_URL);

  let token;
  try {
    token = await getAccessToken();
    console.log(`[apiFetch] Got access token successfully`);
  } catch (err) {
    console.error(`[apiFetch] ERROR getting access token from Supabase:`, err);
    throw err;
  }

  const fetchUrl = `${API_URL}${path}`;
  console.log(`[apiFetch] Executing fetch to: ${fetchUrl}`);

  const response = await fetch(fetchUrl, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
};

/** Download a blob response (CSV / PDF / PNG) */
export const apiFetchBlob = async (path: string, init?: RequestInit): Promise<Blob> => {
  const token = await getAccessToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `Request failed with status ${response.status}`);
  }

  return response.blob();
};

/** Download text response (CSV) */
export const apiFetchText = async (path: string, init?: RequestInit): Promise<string> => {
  const token = await getAccessToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `Request failed with status ${response.status}`);
  }

  return response.text();
};

// ── Auth ───────────────────────────────────────────────────────────
export type AuthSession = { session: Record<string, unknown>; user: Record<string, unknown> };
export type RegisterResult = { userId: string; role: string };

export const apiRegister = (body: { email: string; password: string; fullName: string; phone?: string }) =>
  apiFetch<RegisterResult>("/auth/register", { method: "POST", body: JSON.stringify(body) });

export const apiLogin = (body: { email: string; password: string }) =>
  apiFetch<AuthSession>("/auth/login", { method: "POST", body: JSON.stringify(body) });

export const apiLogout = () =>
  apiFetch<void>("/auth/logout", { method: "POST" });

export const apiRefreshToken = (refreshToken: string) =>
  apiFetch<AuthSession>("/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken }) });

export const apiWeb3Login = (body: { email: string; walletAddress: string; idToken?: string; appPublicKey?: string }) =>
  apiFetch<AuthSession>("/auth/web3-login", { method: "POST", body: JSON.stringify(body) });

export const apiKycUpload = (body: {
  documentType: string;
  gstNumber: string;
  panNumber: string;
  businessName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankAccountName: string;
}) => apiFetch<{ kycStatus: string; message: string }>("/auth/kyc/upload", { method: "POST", body: JSON.stringify(body) });

// ── Users ──────────────────────────────────────────────────────────
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

export const apiGetProfile = () => apiFetch<Profile>("/users/me");

// ── Wallet ─────────────────────────────────────────────────────────
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

export const apiGetWalletTransactions = () =>
  apiFetch<WalletTransaction[]>("/wallet/transactions");

// ── Sessions ───────────────────────────────────────────────────────
export type SessionReconcile = {
  activeSession: Record<string, unknown> | null;
  currentCharge?: number;
  elapsedSeconds?: number;
  lockedRate?: number;
  billingUnit?: string;
};

export const apiReconcileSession = () =>
  apiFetch<SessionReconcile>("/sessions/active/reconcile");

export const apiResumeSession = (id: string) =>
  apiFetch<Record<string, unknown>>(`/sessions/${id}/resume`, { method: "POST" });

export const apiCloseSession = (id: string) =>
  apiFetch<Record<string, unknown>>(`/sessions/${id}/close`, { method: "POST" });

export const apiGetSession = (id: string) =>
  apiFetch<Record<string, unknown>>(`/sessions/${id}`);

export const apiDisputeSession = (id: string, reason: string) =>
  apiFetch<Record<string, unknown>>(`/sessions/${id}/dispute`, {
    method: "POST",
    body: JSON.stringify({ reason })
  });

// ── Billing ────────────────────────────────────────────────────────
export type BillingPreview = {
  elapsedSeconds: number;
  grossInr: number;
  cryptoAmount: number;
  platformFeeInr: number;
  merchantPayoutInr: number;
};

export const apiBillingPreview = (params: Record<string, string | number>) => {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
  return apiFetch<BillingPreview>(`/billing/preview?${qs}`);
};

export const apiGetReceipt = (sessionId: string) =>
  apiFetch<Record<string, unknown>>(`/billing/receipts/${sessionId}`);

export const apiRefundSession = (sessionId: string) =>
  apiFetch<{ sessionId: string; status: string }>(`/billing/refund/${sessionId}`, { method: "POST" });

// ── Notifications ──────────────────────────────────────────────────
export const apiMarkNotificationRead = (id: string) =>
  apiFetch<void>(`/notifications/${id}/read`, { method: "PUT" });

// ── Venues ─────────────────────────────────────────────────────────
export const apiGetVenue = (id: string) =>
  apiFetch<Record<string, unknown>>(`/venues/${id}`);

export const apiUpdateVenue = (id: string, body: Record<string, unknown>) =>
  apiFetch<Record<string, unknown>>(`/venues/${id}`, { method: "PUT", body: JSON.stringify(body) });

export const apiDeleteVenue = (id: string) =>
  apiFetch<void>(`/venues/${id}`, { method: "DELETE" });

// ── Geofences ──────────────────────────────────────────────────────
export const apiUpdateGeofence = (id: string, body: Record<string, unknown>) =>
  apiFetch<Record<string, unknown>>(`/geofences/${id}`, { method: "PUT", body: JSON.stringify(body) });

// ── Merchants ──────────────────────────────────────────────────────
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

export const apiGetMerchant = () => apiFetch<Merchant>("/merchants/me");

export const apiOnboardMerchant = (body: {
  businessName: string;
  businessType: string;
  gstin: string;
  panNumber: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankAccountName: string;
  upiId: string;
}) => apiFetch<Merchant>("/merchants/onboard", { method: "POST", body: JSON.stringify(body) });

export const apiGetMerchantTaxSummary = (financialYear?: string) => {
  const qs = financialYear ? `?financialYear=${financialYear}` : "";
  return apiFetch<Record<string, unknown>>(`/merchants/me/tax-summary${qs}`);
};

// ── Analytics ──────────────────────────────────────────────────────
export type CustomerOverviewRow = {
  created_at: string;
  inr_equivalent: number;
  duration_seconds: number;
  venues?: { name?: string };
};

export const apiCustomerOverview = () =>
  apiFetch<CustomerOverviewRow[]>("/analytics/customer-overview");

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

export const apiMerchantSessions = (status?: string) => {
  const qs = status ? `?status=${status}` : "";
  return apiFetch<MerchantSessionRow[]>(`/analytics/merchant-sessions${qs}`);
};

export const apiExportRevenueCsv = () =>
  apiFetchText("/analytics/export");

// ── Admin ──────────────────────────────────────────────────────────
export const apiAdminMerchants = () =>
  apiFetch<Merchant[]>("/admin/merchants");

export const apiAdminLedger = () =>
  apiFetch<Record<string, unknown>[]>("/admin/operator/ledger");

export const apiAdminSessions = () =>
  apiFetch<Record<string, unknown>[]>("/admin/operator/sessions");

export const apiAdminRunSettlement = (batchDate: string) =>
  apiFetch<{ batchDate: string; result: Record<string, unknown> }>("/admin/settlements/run", {
    method: "POST",
    body: JSON.stringify({ batchDate })
  });

export const apiAdminExportLedgerCsv = () =>
  apiFetchText("/admin/operator/export/ledger");
