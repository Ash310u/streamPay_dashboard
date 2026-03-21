import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { createServiceSupabaseClient } from "@detrix/supabase-client";
import { randomUUID } from "node:crypto";
import { Server } from "socket.io";
import { authClient } from "./lib/supabase-auth.js";
import { env } from "./lib/env.js";
import { isApiError } from "./lib/api-error.js";
import { logger } from "./lib/logger.js";
import { createRealtimeServer } from "./lib/realtime.js";
import type { AuthenticatedUser } from "./types.js";
import { prometheusPlugin2 as prometheusPlugin } from "./plugins/prometheus.js";
import { sentryFastifyPlugin } from "./plugins/sentry.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerAnalyticsRoutes } from "./routes/analytics.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerBillingRoutes } from "./routes/billing.js";
import { registerMerchantRoutes } from "./routes/merchants.js";
import { registerSessionRoutes } from "./routes/sessions.js";
import { registerTaxRoutes } from "./routes/tax.js";
import { registerUserRoutes } from "./routes/users.js";
import { registerVenueRoutes } from "./routes/venues.js";
import { registerWalletRoutes } from "./routes/wallet.js";
import { registerWebhookRoutes } from "./routes/webhooks.js";
import { registerNotificationRoutes } from "./routes/notifications.js";

declare module "fastify" {
  interface FastifyRequest {
    requestId: string;
    user?: AuthenticatedUser;
  }

  interface FastifyInstance {
    supabase: ReturnType<typeof createServiceSupabaseClient>;
    io: Server;
  }
}

export const buildApp = async () => {
  const app = Fastify({
    logger: false
  });

  await app.register(cors, {
    origin: true,
    credentials: true
  });

  await app.register(rateLimit, {
    max: 200,
    timeWindow: "1 minute"
  });

  app.decorate("supabase", createServiceSupabaseClient());
  app.decorate("io", createRealtimeServer(app));

  // Observability
  await app.register(sentryFastifyPlugin);
  await app.register(prometheusPlugin);

  app.addHook("onRequest", async (request, reply) => {
    request.requestId = request.headers["x-request-id"]?.toString() ?? randomUUID();
    reply.header("x-request-id", request.requestId);
  });

  app.addHook("preHandler", async (request) => {
    const header = request.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
      return;
    }

    const token = header.replace("Bearer ", "");
    const { data, error } = await authClient.auth.getUser(token);

    if (error || !data.user) {
      return;
    }

    const { data: profile } = await app.supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();

    request.user = {
      id: data.user.id,
      email: data.user.email,
      role: (profile?.role ?? "user") as AuthenticatedUser["role"]
    };
  });

  app.get("/health", async () => ({
    status: "ok",
    requestId: randomUUID(),
    env: env.NODE_ENV
  }));

  await registerAuthRoutes(app);
  await registerUserRoutes(app);
  await registerMerchantRoutes(app);
  await registerWalletRoutes(app);
  await registerBillingRoutes(app);
  await registerVenueRoutes(app);
  await registerSessionRoutes(app);
  await registerAnalyticsRoutes(app);
  await registerTaxRoutes(app);
  await registerAdminRoutes(app);
  await registerNotificationRoutes(app);
  await registerWebhookRoutes(app);

  app.setErrorHandler((error, request, reply) => {
    const normalizedError = error instanceof Error ? error : new Error("Unexpected error");

    logger.error({
      msg: "request_failed",
      requestId: request.requestId,
      path: request.url,
      error: normalizedError.message
    });

    reply.status(isApiError(error) ? error.statusCode : 500).send({
      error: normalizedError.message,
      requestId: request.requestId
    });
  });

  app.addHook("onClose", async () => {
    await app.io.close();
  });

  return app;
};
