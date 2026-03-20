/**
 * Minimal Razorpay REST client.
 * We call the Razorpay APIs directly via fetch to avoid heavy SDK bundling.
 * All methods are credential-gated: if KEY_ID/KEY_SECRET are empty, they
 * throw immediately so callers can detect the unconfigured state.
 */
import { env } from "./env.js";
import { ApiError } from "./api-error.js";
import { logger } from "./logger.js";

const BASE = "https://api.razorpay.com/v1";

function authHeader() {
  const token = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64");
  return `Basic ${token}`;
}

function hasCreds() {
  return !!env.RAZORPAY_KEY_ID && !!env.RAZORPAY_KEY_SECRET;
}

async function rp<T>(path: string, init?: RequestInit): Promise<T> {
  if (!hasCreds()) {
    throw new ApiError(503, "Razorpay credentials not configured");
  }

  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(),
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { description?: string } } | null;
    const msg = payload?.error?.description ?? `Razorpay error ${response.status}`;
    logger.error({ msg: "razorpay_request_failed", path, status: response.status, razorpayMsg: msg });
    throw new ApiError(502, msg);
  }

  return response.json() as Promise<T>;
}

// ─── Orders ────────────────────────────────────────────────────────────────

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
  receipt: string;
}

export const createOrder = (amountInPaise: number, receipt: string, notes: Record<string, string> = {}): Promise<RazorpayOrder> =>
  rp<RazorpayOrder>("/orders", {
    method: "POST",
    body: JSON.stringify({ amount: amountInPaise, currency: "INR", receipt, notes })
  });

// ─── Contacts ──────────────────────────────────────────────────────────────

export interface RazorpayContact {
  id: string;
  name: string;
  email: string | null;
  contact: string | null;
  type: string;
}

export const createContact = (name: string, email: string | null, phone: string | null): Promise<RazorpayContact> =>
  rp<RazorpayContact>("/contacts", {
    method: "POST",
    body: JSON.stringify({ name, email: email ?? undefined, contact: phone ?? undefined, type: "vendor" })
  });

// ─── Fund Accounts ─────────────────────────────────────────────────────────

export interface RazorpayFundAccount {
  id: string;
  contact_id: string;
  account_type: string;
}

export const createBankFundAccount = (
  contactId: string,
  bankAccountName: string,
  bankAccountNumber: string,
  bankIfsc: string
): Promise<RazorpayFundAccount> =>
  rp<RazorpayFundAccount>("/fund_accounts", {
    method: "POST",
    body: JSON.stringify({
      contact_id: contactId,
      account_type: "bank_account",
      bank_account: {
        name: bankAccountName,
        account_number: bankAccountNumber,
        ifsc: bankIfsc
      }
    })
  });

// ─── Payouts ───────────────────────────────────────────────────────────────

export interface RazorpayPayout {
  id: string;
  fund_account_id: string;
  amount: number;
  currency: string;
  status: string;
  reference_id: string;
}

export const createPayout = (
  fundAccountId: string,
  amountInPaise: number,
  referenceId: string,
  narration: string,
  notes: Record<string, string> = {}
): Promise<RazorpayPayout> => {
  if (!env.RAZORPAY_ACCOUNT_NUMBER) {
    throw new ApiError(503, "RAZORPAY_ACCOUNT_NUMBER not configured for payouts");
  }

  return rp<RazorpayPayout>("/payouts", {
    method: "POST",
    body: JSON.stringify({
      account_number: env.RAZORPAY_ACCOUNT_NUMBER,
      fund_account_id: fundAccountId,
      amount: amountInPaise,
      currency: "INR",
      mode: "NEFT",
      purpose: "payout",
      queue_if_low_balance: true,
      reference_id: referenceId,
      narration,
      notes
    })
  });
};

export const isConfigured = hasCreds;
