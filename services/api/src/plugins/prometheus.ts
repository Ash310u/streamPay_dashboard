/**
 * Fastify Prometheus metrics plugin.
 * Registers GET /metrics (Prometheus scrape target, no auth — keep internal)
 * and instruments all routes with per-route request count + duration histograms.
 */
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

const NAMESPACE = "detrix_api";

const prometheusPlugin: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Lazy import — only if prom-client is installed
  let register: import("prom-client").Registry;
  let httpRequestTotal: import("prom-client").Counter;
  let httpRequestDuration: import("prom-client").Histogram;

  try {
    const prom = await import("prom-client");
    prom.collectDefaultMetrics({ register: prom.register, prefix: `${NAMESPACE}_` });
    register = prom.register;

    httpRequestTotal = new prom.Counter({
      name: `${NAMESPACE}_http_requests_total`,
      help: "Total number of HTTP requests",
      labelNames: ["method", "route", "status_code"]
    });

    httpRequestDuration = new prom.Histogram({
      name: `${NAMESPACE}_http_request_duration_seconds`,
      help: "Duration of HTTP requests in seconds",
      labelNames: ["method", "route"],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]
    });

    // Instrument all routes
    app.addHook("onResponse", (request, reply, done) => {
      const route = request.routeOptions?.url ?? request.url;
      const labels = { method: request.method, route };
      httpRequestTotal.labels({ ...labels, status_code: String(reply.statusCode) }).inc();
      httpRequestDuration.labels(labels).observe((reply.elapsedTime ?? 0) / 1000);
      done();
    });

    // Scrape endpoint (should be behind internal network / not exposed via public Nginx)
    app.get("/metrics", { config: { skipAuth: true } }, async (_request, reply) => {
      reply.header("Content-Type", register.contentType);
      return reply.send(await register.metrics());
    });

    app.log.info({ msg: "prometheus_metrics_enabled" });
  } catch {
    app.log.warn({ msg: "prom-client not installed — metrics disabled" });
  }
};

export const prometheusPlugin2 = fp(prometheusPlugin, {
  name: "prometheus",
  fastify: ">=4"
});
