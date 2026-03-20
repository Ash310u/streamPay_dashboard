import { createHmac, timingSafeEqual } from "node:crypto";

export interface SignedQrPayload {
  venueId: string;
  pricingPlanId?: string;
  action?: "entry" | "exit";
  nonce: string;
  expiresAt: string;
}

const encodePayload = (payload: SignedQrPayload): string =>
  JSON.stringify({
    venueId: payload.venueId,
    pricingPlanId: payload.pricingPlanId,
    action: payload.action,
    nonce: payload.nonce,
    expiresAt: payload.expiresAt
  });

export const signQrPayload = (payload: SignedQrPayload, secret: string): string => {
  return createHmac("sha256", secret).update(encodePayload(payload)).digest("hex");
};

export const validateQrPayload = (payload: SignedQrPayload, signature: string, secret: string): boolean => {
  const calculated = signQrPayload(payload, secret);
  return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(calculated, "hex"));
};

export const isQrExpired = (expiresAt: string, now = new Date()): boolean => {
  return new Date(expiresAt).getTime() <= now.getTime();
};
