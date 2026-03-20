import type { FastifyInstance } from "fastify";
import { requireAuth, sendApiError } from "../lib/guards.js";

export const registerUserRoutes = async (app: FastifyInstance) => {
  app.get("/users/me", async (request, reply) => {
    try {
      const user = requireAuth(request);
      const { data, error } = await app.supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();

      if (error) {
        return reply.status(400).send({ error: error.message });
      }

      return reply.send(data);
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  app.get("/users/me/wallet", async (request, reply) => {
    try {
      const user = requireAuth(request);
      const { data, error } = await app.supabase.from("wallets").select("*").eq("user_id", user.id).maybeSingle();

      if (error) {
        return reply.status(400).send({ error: error.message });
      }

      return reply.send(data);
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  app.get("/users/me/sessions", async (request, reply) => {
    try {
      const user = requireAuth(request);
      const { data, error } = await app.supabase
        .from("sessions")
        .select("*, venues(name,city)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        return reply.status(400).send({ error: error.message });
      }

      return reply.send(data);
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  app.get("/users/me/notifications", async (request, reply) => {
    try {
      const user = requireAuth(request);
      const { data, error } = await app.supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        return reply.status(400).send({ error: error.message });
      }

      return reply.send(data);
    } catch (error) {
      return sendApiError(reply, error);
    }
  });
};
