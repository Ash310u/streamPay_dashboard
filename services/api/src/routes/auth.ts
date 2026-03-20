import type { FastifyInstance } from "fastify";
import { authClient } from "../lib/supabase-auth.js";
import { authLoginSchema, authRegisterSchema } from "@detrix/zod-schemas";

export const registerAuthRoutes = async (app: FastifyInstance) => {
  app.post("/auth/register", async (request, reply) => {
    const payload = authRegisterSchema.parse(request.body);

    const { data, error } = await app.supabase.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        full_name: payload.fullName
      }
    });

    if (error) {
      return reply.status(400).send({ error: error.message });
    }

    return reply.status(201).send({
      userId: data.user.id,
      role: "user"
    });
  });

  app.post("/auth/login", async (request, reply) => {
    const payload = authLoginSchema.parse(request.body);
    const result = await authClient.auth.signInWithPassword({
      email: payload.email,
      password: payload.password
    });

    if (result.error) {
      return reply.status(401).send({ error: result.error.message });
    }

    return reply.send({
      session: result.data.session,
      user: result.data.user
    });
  });

  app.post("/auth/logout", async () => reply.status(204).send());

  app.post("/auth/refresh", async (request, reply) => {
    const payload = request.body as { refreshToken?: string };

    if (!payload.refreshToken) {
      return reply.status(400).send({ error: "refreshToken is required" });
    }

    const result = await authClient.auth.refreshSession({
      refresh_token: payload.refreshToken
    });

    if (result.error) {
      return reply.status(401).send({ error: result.error.message });
    }

    return reply.send(result.data);
  });

  app.post("/auth/web3-login", async (request, reply) => {
    const payload = request.body as { email?: string; walletAddress?: string };

    if (!payload.email) {
      return reply.status(400).send({ error: "email is required for Web3Auth bridge login" });
    }

    const password = `web3_${payload.walletAddress ?? "wallet"}_Detrix!2026`;
    const existing = await authClient.auth.signInWithPassword({
      email: payload.email,
      password
    });

    if (!existing.error) {
      return reply.send(existing.data);
    }

    const created = await app.supabase.auth.admin.createUser({
      email: payload.email,
      password,
      email_confirm: true,
      user_metadata: {
        wallet_address: payload.walletAddress
      }
    });

    if (created.error) {
      return reply.status(400).send({ error: created.error.message });
    }

    const login = await authClient.auth.signInWithPassword({
      email: payload.email,
      password
    });

    if (login.error) {
      return reply.status(401).send({ error: login.error.message });
    }

    return reply.send(login.data);
  });
};
