import type { FastifyInstance } from "fastify";
import { WebhookService } from "../services/webhook-service.js";

export const registerWebhookRoutes = async (app: FastifyInstance) => {
  const webhookService = new WebhookService(app);

  app.post("/webhooks/razorpay", async (request, reply) => {
    const signature = request.headers["x-razorpay-signature"];

    if (typeof signature !== "string") {
      return reply.status(400).send({ error: "Missing signature" });
    }

    const rawBody = JSON.stringify(request.body ?? {});

    if (!webhookService.verifySignature(rawBody, signature)) {
      return reply.status(401).send({ error: "Invalid signature" });
    }

    const result = await webhookService.processRazorpayWebhook((request.body ?? {}) as Record<string, unknown>);
    return reply.status(202).send(result);
  });
};
