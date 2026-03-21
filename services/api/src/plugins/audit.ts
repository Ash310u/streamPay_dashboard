/**
 * Audit logging middleware for Fastify.
 * Logs all mutating requests (POST, PUT, PATCH, DELETE) with
 * user context, request body hash, and response status.
 */
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { createHash } from "node:crypto";

const auditPlugin: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.addHook("onResponse", async (request, reply) => {
    // Only audit mutating requests
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return;

    // Skip health checks and metrics
    if (request.url === "/health" || request.url === "/metrics") return;

    const userId = (request as unknown as { user?: { id?: string } }).user?.id ?? "anonymous";
    const bodyHash = request.body
      ? createHash("sha256").update(JSON.stringify(request.body)).digest("hex").slice(0, 16)
      : null;

    const entry = {
      timestamp: new Date().toISOString(),
      method: request.method,
      url: request.url,
      userId,
      statusCode: reply.statusCode,
      requestId: (request as unknown as { requestId?: string }).requestId ?? null,
      bodyHash,
      responseTime: reply.elapsedTime ?? null,
      ip: request.ip
    };

    // Persist to Supabase audit_logs table (fire-and-forget)
    void app.supabase.from("audit_logs").insert(entry).then(({ error }) => {
      if (error) {
        app.log.warn({ msg: "audit_log_insert_failed", error: error.message });
      }
    });
  });

  app.log.info({ msg: "audit_logging_enabled" });
};

export const auditLoggingPlugin = fp(auditPlugin, {
  name: "audit-logging",
  fastify: ">=4"
});
