import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import QRCode from "qrcode";
import { geofenceSchema, pricingPlanSchema, venueSchema } from "@detrix/zod-schemas";
import { requireRole, sendApiError } from "../lib/guards.js";

export const registerVenueRoutes = async (app: FastifyInstance) => {
  app.get("/venues", async (request) => {
    const city = typeof request.query === "object" && request.query !== null ? (request.query as Record<string, string>).city : undefined;
    let query = app.supabase.from("venues").select("*").eq("is_active", true);

    if (city) {
      query = query.eq("city", city);
    }

    const { data } = await query.order("created_at", { ascending: false });
    return data;
  });

  app.post("/venues", async (request, reply) => {
    try {
      const user = requireRole(request, ["merchant", "admin"]);
      const payload = venueSchema.parse(request.body);
      const { data, error } = await app.supabase.from("venues").insert({
        merchant_id: user.id,
        name: payload.name,
        description: payload.description,
        category: payload.category,
        address: payload.address,
        city: payload.city,
        lat: payload.lat,
        lng: payload.lng
      }).select("*").single();

      if (error) {
        return reply.status(400).send({ error: error.message });
      }

      return reply.status(201).send(data);
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  app.get("/venues/:id", async (request, reply) => {
    const venueId = (request.params as { id: string }).id;
    const { data, error } = await app.supabase.from("venues").select("*").eq("id", venueId).maybeSingle();
    if (error) {
      return reply.status(400).send({ error: error.message });
    }
    return reply.send(data);
  });

  app.put("/venues/:id", async (request, reply) => {
    try {
      requireRole(request, ["merchant", "admin"]);
      const payload = venueSchema.parse(request.body);
      const venueId = (request.params as { id: string }).id;
      const { data, error } = await app.supabase.from("venues").update({
        name: payload.name,
        description: payload.description,
        category: payload.category,
        address: payload.address,
        city: payload.city,
        lat: payload.lat,
        lng: payload.lng
      }).eq("id", venueId).select("*").single();

      if (error) {
        return reply.status(400).send({ error: error.message });
      }

      return reply.send(data);
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  app.delete("/venues/:id", async (request, reply) => {
    try {
      requireRole(request, ["merchant", "admin"]);
      const venueId = (request.params as { id: string }).id;
      await app.supabase.from("venues").update({ is_active: false }).eq("id", venueId);
      return reply.status(204).send();
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  app.post("/venues/:id/geofences", async (request, reply) => {
    try {
      requireRole(request, ["merchant", "admin"]);
      const payload = geofenceSchema.parse(request.body);
      const venueId = (request.params as { id: string }).id;

      const insert =
        payload.type === "circle"
          ? {
              venue_id: venueId,
              type: "circle",
              center_lat: payload.centerLat,
              center_lng: payload.centerLng,
              radius_meters: payload.radiusMeters
            }
          : {
              venue_id: venueId,
              type: "polygon",
              polygon_coordinates: payload.polygonCoordinates
            };

      const { data, error } = await app.supabase.from("geofences").insert(insert).select("*").single();

      if (error) {
        return reply.status(400).send({ error: error.message });
      }

      return reply.status(201).send(data);
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  app.get("/venues/:id/geofences", async (request, reply) => {
    const venueId = (request.params as { id: string }).id;
    const { data, error } = await app.supabase.from("geofences").select("*").eq("venue_id", venueId);
    if (error) {
      return reply.status(400).send({ error: error.message });
    }
    return reply.send(data);
  });

  app.put("/geofences/:id", async (request, reply) => {
    try {
      requireRole(request, ["merchant", "admin"]);
      const payload = geofenceSchema.parse(request.body);
      const geofenceId = (request.params as { id: string }).id;
      const update =
        payload.type === "circle"
          ? {
              type: "circle",
              center_lat: payload.centerLat,
              center_lng: payload.centerLng,
              radius_meters: payload.radiusMeters,
              polygon_coordinates: null
            }
          : {
              type: "polygon",
              center_lat: null,
              center_lng: null,
              radius_meters: null,
              polygon_coordinates: payload.polygonCoordinates
            };
      const { data, error } = await app.supabase.from("geofences").update(update).eq("id", geofenceId).select("*").single();
      if (error) {
        return reply.status(400).send({ error: error.message });
      }
      return reply.send(data);
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  app.delete("/geofences/:id", async (request, reply) => {
    try {
      requireRole(request, ["merchant", "admin"]);
      const geofenceId = (request.params as { id: string }).id;
      await app.supabase.from("geofences").delete().eq("id", geofenceId);
      return reply.status(204).send();
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  app.post("/venues/:id/pricing", async (request, reply) => {
    try {
      requireRole(request, ["merchant", "admin"]);
      const payload = pricingPlanSchema.parse(request.body);
      const venueId = (request.params as { id: string }).id;
      const { data, error } = await app.supabase.from("pricing_plans").insert({
        venue_id: venueId,
        name: payload.name,
        billing_unit: payload.billingUnit,
        rate_crypto: payload.rateCrypto,
        rate_inr_equivalent: payload.rateInrEquivalent,
        base_fee_inr: payload.baseFeeInr,
        minimum_charge_inr: payload.minimumChargeInr,
        maximum_cap_inr: payload.maximumCapInr,
        grace_period_seconds: payload.gracePeriodSeconds
      }).select("*").single();

      if (error) {
        return reply.status(400).send({ error: error.message });
      }

      return reply.status(201).send(data);
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  app.get("/venues/:id/pricing", async (request, reply) => {
    const venueId = (request.params as { id: string }).id;
    const { data, error } = await app.supabase.from("pricing_plans").select("*").eq("venue_id", venueId).order("created_at", { ascending: false });
    if (error) {
      return reply.status(400).send({ error: error.message });
    }
    return reply.send(data);
  });

  app.put("/pricing/:id", async (request, reply) => {
    try {
      requireRole(request, ["merchant", "admin"]);
      const rawBody = (request.body ?? {}) as Record<string, unknown>;
      const pricingId = (request.params as { id: string }).id;

      const update =
        rawBody.name || rawBody.billingUnit || rawBody.rateCrypto || rawBody.rateInrEquivalent
          ? (() => {
              const payload = pricingPlanSchema.parse(request.body);
              return {
                name: payload.name,
                billing_unit: payload.billingUnit,
                rate_crypto: payload.rateCrypto,
                rate_inr_equivalent: payload.rateInrEquivalent,
                base_fee_inr: payload.baseFeeInr,
                minimum_charge_inr: payload.minimumChargeInr,
                maximum_cap_inr: payload.maximumCapInr,
                grace_period_seconds: payload.gracePeriodSeconds,
                ...(typeof rawBody.isActive === "boolean" ? { is_active: rawBody.isActive } : {})
              };
            })()
          : {
              ...(typeof rawBody.isActive === "boolean" ? { is_active: rawBody.isActive } : {})
            };

      const { data, error } = await app.supabase.from("pricing_plans").update(update).eq("id", pricingId).select("*").single();
      if (error) {
        return reply.status(400).send({ error: error.message });
      }
      return reply.send(data);
    } catch (error) {
      return sendApiError(reply, error);
    }
  });
  // ── QR PNG Download ────────────────────────────────────────────────────────

  app.get("/venues/:id/qr.png", async (request, reply) => {
    const venueId = (request.params as { id: string }).id;

    const { data: venue, error } = await app.supabase
      .from("venues")
      .select("id, name")
      .eq("id", venueId)
      .maybeSingle();

    if (error || !venue) return reply.status(404).send({ error: "Venue not found" });

    const { data: plan } = await app.supabase
      .from("pricing_plans")
      .select("id")
      .eq("venue_id", venueId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nonce = randomUUID();
    const deeplink = `detrix://venue/${venueId}?plan=${plan?.id ?? ""}&nonce=${nonce}`;

    const pngBuffer = await QRCode.toBuffer(deeplink, {
      type: "png",
      width: 400,
      margin: 2,
      color: { dark: "#132238", light: "#f4fbff" }
    });

    return reply
      .header("Content-Type", "image/png")
      .header("Content-Disposition", `attachment; filename="qr-${venueId}.png"`)
      .header("Cache-Control", "no-store")
      .send(pngBuffer);
  });
};
