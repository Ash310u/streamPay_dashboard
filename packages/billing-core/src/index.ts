import type { ChargeSnapshot, FinalSettlement, RefundResult, Session, StreamHandle } from "@detrix/shared-types";

export interface BillingProvider {
  startStream(session: Session): Promise<StreamHandle>;
  stopStream(handle: StreamHandle): Promise<FinalSettlement>;
  getCurrentCharge(handle: StreamHandle): Promise<ChargeSnapshot>;
  refund(session: Session, amount: number): Promise<RefundResult>;
}

export const billingUnitToSeconds = (billingUnit: "per_second" | "per_minute" | "per_hour"): number => {
  switch (billingUnit) {
    case "per_second":
      return 1;
    case "per_minute":
      return 60;
    case "per_hour":
      return 3600;
  }
};

export interface BillingCalculationInput {
  elapsedSeconds: number;
  billingUnit: "per_second" | "per_minute" | "per_hour";
  rateCrypto: number;
  lockedRate: number;
  minimumChargeInr: number;
  maximumCapInr?: number | null;
  baseFeeInr?: number;
  platformFeeRate: number;
}

export interface BillingCalculationResult {
  cryptoAmount: number;
  grossInr: number;
  platformFeeInr: number;
  merchantPayoutInr: number;
}

export const calculateCharge = (input: BillingCalculationInput): BillingCalculationResult => {
  const unitSeconds = billingUnitToSeconds(input.billingUnit);
  const rawCrypto = (input.elapsedSeconds / unitSeconds) * input.rateCrypto;
  const rawInr = rawCrypto * input.lockedRate + (input.baseFeeInr ?? 0);
  const minAdjusted = Math.max(rawInr, input.minimumChargeInr);
  const capped = input.maximumCapInr ? Math.min(minAdjusted, input.maximumCapInr) : minAdjusted;
  const fee = Number((capped * input.platformFeeRate).toFixed(2));
  const merchant = Number((capped - fee).toFixed(2));
  const cryptoAmount = Number((capped / input.lockedRate).toFixed(8));

  return {
    cryptoAmount,
    grossInr: Number(capped.toFixed(2)),
    platformFeeInr: fee,
    merchantPayoutInr: merchant
  };
};

