import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

const sentryPlugin: FastifyPluginAsync = async (app: FastifyInstance) => {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    app.log.info({ msg: "sentry_dsn_not_set_skipping" });
    return;
  }

  try {
    const Sentry = await import("@sentry/node");

    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV ?? "development",
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
      integrations: []
    });

    // Capture all unhandled errors
    app.setErrorHandler((error, _request, reply) => {
      const normalizedError = error instanceof Error ? error : new Error("Unexpected error");

      Sentry.captureException(error, {
        extra: {
          url: _request.url,
          method: _request.method,
          userId: (_request as unknown as { user?: { id?: string } }).user?.id
        }
      });

      const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
      void reply.status(statusCode).send({
        error: statusCode >= 500 ? "Internal Server Error" : normalizedError.message
      });
    });

    // Capture unhandled promise rejections
    process.on("unhandledRejection", (reason) => {
      Sentry.captureException(reason);
    });

    app.log.info({ msg: "sentry_initialized", env: process.env.NODE_ENV });
  } catch {
    app.log.warn({ msg: "sentry_package_not_installed_skipping" });
  }
};

export const sentryFastifyPlugin = fp(sentryPlugin, {
  name: "sentry",
  fastify: ">=4"
});
