export type AppRole = "user" | "merchant" | "admin";
export type KycStatus = "pending" | "verified" | "rejected";
export type WalletTransactionType = "top_up" | "session_debit" | "refund" | "adjustment";
export type TransactionStatus = "pending" | "success" | "failed";
export type BusinessType = "gym" | "ev_charger" | "coworking" | "parking" | "lab" | "other";
export type GeofenceType = "circle" | "polygon";
export type BillingUnit = "per_second" | "per_minute" | "per_hour";
export type SessionStatus = "enter_detected" | "active" | "exit_detected" | "closed" | "disputed";
export type SessionEventType =
  | "entered"
  | "billing_started"
  | "billing_updated"
  | "exited"
  | "stream_paused"
  | "stream_resumed"
  | "closed"
  | "error";
export type SettlementStatus = "pending" | "processing" | "completed" | "failed";
export type TriggerMode = "geofence" | "qr" | "self_checkout";
export type QrCodeType = "entry" | "exit";

export interface Profile {
  id: string;
  fullName: string | null;
  phone: string | null;
  role: AppRole;
  kycStatus: KycStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Wallet {
  id: string;
  userId: string;
  balanceCrypto: string;
  balanceInrEquivalent: string;
  lockedBalance: string;
  currencyCode: string;
  createdAt: string;
  updatedAt: string;
}

export interface Merchant {
  id: string;
  businessName: string;
  businessType: BusinessType;
  gstin: string | null;
  panNumber: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  bankAccountName: string | null;
  upiId: string | null;
  razorpayContactId: string | null;
  razorpayFundAccountId: string | null;
  settlementStatus: SettlementStatus;
  qrSecret?: string;
  onboardedAt: string;
}

export interface Venue {
  id: string;
  merchantId: string;
  name: string;
  description: string | null;
  category: BusinessType;
  address: string;
  city: string;
  lat: number;
  lng: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Geofence {
  id: string;
  venueId: string;
  type: GeofenceType;
  centerLat: number | null;
  centerLng: number | null;
  radiusMeters: number | null;
  polygonCoordinates: Array<[number, number]> | null;
  createdAt: string;
}

export interface PricingPlan {
  id: string;
  venueId: string;
  name: string;
  billingUnit: BillingUnit;
  rateCrypto: string;
  rateInrEquivalent: string;
  baseFeeInr: string;
  minimumChargeInr: string;
  maximumCapInr: string | null;
  gracePeriodSeconds: number;
  isActive: boolean;
  createdAt: string;
}

export interface Session {
  id: string;
  userId: string;
  venueId: string;
  pricingPlanId: string;
  status: SessionStatus;
  triggerMode: TriggerMode;
  qrNonceUsed: string | null;
  entryLat: number | null;
  entryLng: number | null;
  exitLat: number | null;
  exitLng: number | null;
  entryTime: string;
  exitTime: string | null;
  durationSeconds: number;
  lockedRate: string | null;
  cryptoCharged: string;
  inrEquivalent: string;
  platformFeeInr: string;
  platformFeeRate: string;
  merchantPayoutInr: string;
  superfluidStreamId: string | null;
  settlementBatchId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StreamHandle {
  streamId: string;
  provider: "superfluid" | "ledger";
  startedAt: string;
}

export interface ChargeSnapshot {
  cryptoAmount: number;
  inrAmount: number;
  elapsedSeconds: number;
  lockedRate: number;
}

export interface FinalSettlement {
  cryptoAmount: number;
  grossInr: number;
  feeInr: number;
  netMerchantInr: number;
  stoppedAt: string;
}

export interface RefundResult {
  refundId: string;
  amountInr: number;
  amountCrypto: number;
  status: "queued" | "processed";
}

export interface SessionLocationEvent {
  venueId: string;
  lat: number;
  lng: number;
  occurredAt: string;
  idempotencyKey: string;
}

