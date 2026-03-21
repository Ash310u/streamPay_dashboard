/**
 * Notification token registration route + push send surface.
 * Stores Expo push tokens and sends notifications via the notification service.
 */
import type { FastifyInstance } from "fastify";
import { requireRole, sendApiError } from "../lib/guards.js";

export const registerNotificationRoutes = async (app: FastifyInstance) => {
  /** Register a push notification token */
  app.post("/notifications/register-token", async (request, reply) => {
    try {
      const user = requireRole(request, ["user", "merchant", "admin"]);
      const { pushToken, platform, deviceName } = request.body as {
        pushToken: string;
        platform: string;
        deviceName?: string;
      };

      if (!pushToken) {
        return reply.status(400).send({ error: "pushToken is required" });
      }

      // Upsert token: one token per device
      await app.supabase
        .from("push_tokens")
        .upsert(
          {
            user_id: user.id,
            token: pushToken,
            platform,
            device_name: deviceName ?? null,
            updated_at: new Date().toISOString()
          },
          { onConflict: "token" }
        );

      return reply.status(200).send({ registered: true });
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  /** Remove a push token (logout) */
  app.delete("/notifications/unregister-token", async (request, reply) => {
    try {
      const user = requireRole(request, ["user", "merchant", "admin"]);
      const { pushToken } = request.body as { pushToken: string };

      await app.supabase
        .from("push_tokens")
        .delete()
        .eq("user_id", user.id)
        .eq("token", pushToken);

      return reply.status(204).send();
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  /** Get user notifications (in-app) */
  app.get("/notifications", async (request, reply) => {
    try {
      const user = requireRole(request, ["user", "merchant", "admin"]);
      const { data, error } = await app.supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) return reply.status(400).send({ error: error.message });
      return reply.send(data);
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  /** Mark notification as read */
  app.put("/notifications/:id/read", async (request, reply) => {
    try {
      const user = requireRole(request, ["user", "merchant", "admin"]);
      const notifId = (request.params as { id: string }).id;

      await app.supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notifId)
        .eq("user_id", user.id);

      return reply.status(204).send();
    } catch (error) {
      return sendApiError(reply, error);
    }
  });
};
