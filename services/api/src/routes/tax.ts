import type { FastifyInstance } from "fastify";
import { requireRole, sendApiError } from "../lib/guards.js";
import { TaxAssistantDomainService } from "../services/tax-assistant-domain-service.js";

export const registerTaxRoutes = async (app: FastifyInstance) => {
  const taxService = new TaxAssistantDomainService(app);

  app.post("/tax/chat", async (request, reply) => {
    try {
      const user = requireRole(request, ["merchant", "admin"]);
      const payload = request.body as { question: string; financialYear?: string };
      const result = await taxService.chat(user.id, payload.question, payload.financialYear ?? "2025-2026");
      return reply.send(result);
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  app.get("/tax/summary", async (request, reply) => {
    try {
      const user = requireRole(request, ["merchant", "admin"]);
      const financialYear = ((request.query as { financialYear?: string }).financialYear ?? "2025-2026");
      const result = await taxService.getSummary(user.id, financialYear);
      return reply.send(result);
    } catch (error) {
      return sendApiError(reply, error);
    }
  });

  app.post("/tax/summary/generate-pdf", async (request, reply) => {
    try {
      const user = requireRole(request, ["merchant", "admin"]);
      const payload = request.body as { financialYear?: string } | undefined;
      const result = await taxService.generatePdf(user.id, payload?.financialYear ?? "2025-2026");
      return reply.send(result);
    } catch (error) {
      return sendApiError(reply, error);
    }
  });
};
