import { z } from "zod";

export const authRegisterSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(72),
  fullName: z.string().min(2).max(120),
  phone: z.string().min(10).max(20).optional()
});

export const authLoginSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(72)
});

export const venueSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(1000).optional(),
  category: z.enum(["gym", "ev_charger", "coworking", "parking", "lab", "other"]),
  address: z.string().min(10).max(255),
  city: z.string().min(2).max(120),
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180)
});

export const geofenceSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("circle"),
    centerLat: z.number().gte(-90).lte(90),
    centerLng: z.number().gte(-180).lte(180),
    radiusMeters: z.number().positive().max(5000)
  }),
  z.object({
    type: z.literal("polygon"),
    polygonCoordinates: z.array(z.tuple([z.number().gte(-90).lte(90), z.number().gte(-180).lte(180)])).min(3)
  })
]);

export const pricingPlanSchema = z.object({
  name: z.string().min(2).max(120),
  billingUnit: z.enum(["per_second", "per_minute", "per_hour"]),
  rateCrypto: z.number().positive(),
  rateInrEquivalent: z.number().positive(),
  baseFeeInr: z.number().min(0),
  minimumChargeInr: z.number().min(0),
  maximumCapInr: z.number().positive().nullable().optional(),
  gracePeriodSeconds: z.number().int().min(0).max(600)
});

export const locationEventSchema = z.object({
  venueId: z.uuid(),
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
  occurredAt: z.iso.datetime(),
  idempotencyKey: z.string().min(16).max(128)
});

export const qrTokenSchema = z.object({
  venueId: z.uuid(),
  pricingPlanId: z.uuid().optional(),
  action: z.enum(["entry", "exit"]).optional(),
  nonce: z.string().min(16).max(128),
  expiresAt: z.iso.datetime(),
  signature: z.string().min(64).max(256)
});

export const qrStartSchema = z.object({
  token: qrTokenSchema.extend({
    pricingPlanId: z.uuid()
  }),
  idempotencyKey: z.string().min(16).max(128)
});

export const qrStopSchema = z.object({
  token: qrTokenSchema.extend({
    action: z.literal("exit")
  }),
  idempotencyKey: z.string().min(16).max(128)
});

export const topUpOrderSchema = z.object({
  amountInr: z.number().positive().max(100000),
  currency: z.literal("INR").default("INR")
});

export const disputeSchema = z.object({
  reason: z.string().min(10).max(1000)
});

export type AuthRegisterInput = z.infer<typeof authRegisterSchema>;
export type AuthLoginInput = z.infer<typeof authLoginSchema>;
export type VenueInput = z.infer<typeof venueSchema>;
export type GeofenceInput = z.infer<typeof geofenceSchema>;
export type PricingPlanInput = z.infer<typeof pricingPlanSchema>;
export type LocationEventInput = z.infer<typeof locationEventSchema>;
export type QrStartInput = z.infer<typeof qrStartSchema>;
export type QrStopInput = z.infer<typeof qrStopSchema>;
export type TopUpOrderInput = z.infer<typeof topUpOrderSchema>;

