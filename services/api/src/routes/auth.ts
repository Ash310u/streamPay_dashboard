import type { FastifyInstance } from "fastify";
import { authClient } from "../lib/supabase-auth.js";
import { authLoginSchema, authRegisterSchema } from "@detrix/zod-schemas";

export const registerAuthRoutes = async (app: FastifyInstance) => {
  // ── Email auth ───────────────────────────────────────────────────

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

  app.post("/auth/logout", async (_request, reply) => reply.status(204).send());

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

  // ── Google OAuth ─────────────────────────────────────────────────

  app.get("/auth/google", async (_request, reply) => {
    const redirectTo = `${process.env.API_BASE_URL ?? "http://localhost:4000"}/auth/google/callback`;
    const { data, error } = await authClient.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo }
    });

    if (error || !data.url) {
      return reply.status(500).send({ error: error?.message ?? "OAuth initiation failed" });
    }

    return reply.redirect(data.url);
  });

  app.get("/auth/google/callback", async (request, reply) => {
    const { code } = request.query as { code?: string };

    if (!code) {
      return reply.status(400).send({ error: "Missing authorization code" });
    }

    const { data, error } = await authClient.auth.exchangeCodeForSession(code);

    if (error || !data.session) {
      return reply.status(401).send({ error: error?.message ?? "Code exchange failed" });
    }

    // Ensure profile exists
    const userId = data.session.user.id;
    const { data: profile } = await app.supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (!profile) {
      await app.supabase.from("profiles").insert({
        id: userId,
        full_name: data.session.user.user_metadata?.full_name ?? data.session.user.email?.split("@")[0],
        role: "user",
        kyc_status: "pending"
      });
    }

    // Redirect to frontend with tokens
    const clientUrl = process.env.DASHBOARD_URL ?? "http://localhost:5173";
    const params = new URLSearchParams({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      provider: "google"
    });
    return reply.redirect(`${clientUrl}/auth/callback?${params.toString()}`);
  });

  // ── GitHub OAuth ─────────────────────────────────────────────────

  app.get("/auth/github", async (_request, reply) => {
    const redirectTo = `${process.env.API_BASE_URL ?? "http://localhost:4000"}/auth/github/callback`;
    const { data, error } = await authClient.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo }
    });

    if (error || !data.url) {
      return reply.status(500).send({ error: error?.message ?? "OAuth initiation failed" });
    }

    return reply.redirect(data.url);
  });

  app.get("/auth/github/callback", async (request, reply) => {
    const { code } = request.query as { code?: string };

    if (!code) {
      return reply.status(400).send({ error: "Missing authorization code" });
    }

    const { data, error } = await authClient.auth.exchangeCodeForSession(code);

    if (error || !data.session) {
      return reply.status(401).send({ error: error?.message ?? "Code exchange failed" });
    }

    const userId = data.session.user.id;
    const { data: profile } = await app.supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (!profile) {
      await app.supabase.from("profiles").insert({
        id: userId,
        full_name: data.session.user.user_metadata?.full_name ?? data.session.user.user_metadata?.user_name ?? "User",
        role: "user",
        kyc_status: "pending"
      });
    }

    const clientUrl = process.env.DASHBOARD_URL ?? "http://localhost:5173";
    const params = new URLSearchParams({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      provider: "github"
    });
    return reply.redirect(`${clientUrl}/auth/callback?${params.toString()}`);
  });

  // ── Web3Auth ─────────────────────────────────────────────────────

  app.post("/auth/web3-login", async (request, reply) => {
    const payload = request.body as {
      email?: string;
      walletAddress?: string;
      idToken?: string;
      appPublicKey?: string;
    };

    if (!payload.email) {
      return reply.status(400).send({ error: "email is required for Web3Auth bridge login" });
    }

    // Verify Web3Auth JWT if verifier is configured
    if (payload.idToken && process.env.WEB3AUTH_VERIFIER_ID) {
      try {
        const verifyUrl = `https://api.web3auth.io/api/v2/verify`;
        const verifyResponse = await fetch(verifyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idToken: payload.idToken,
            appPublicKey: payload.appPublicKey,
            network: process.env.WEB3AUTH_NETWORK ?? "sapphire_mainnet"
          })
        });

        if (!verifyResponse.ok) {
          return reply.status(401).send({ error: "Web3Auth token verification failed" });
        }
      } catch {
        return reply.status(502).send({ error: "Web3Auth verification service unavailable" });
      }
    }

    const password = `web3_${payload.walletAddress ?? "wallet"}_Detrix!2026`;
    const existing = await authClient.auth.signInWithPassword({
      email: payload.email,
      password
    });

    if (!existing.error) {
      // Update wallet address if changed
      if (payload.walletAddress) {
        await app.supabase
          .from("profiles")
          .update({ wallet_address: payload.walletAddress })
          .eq("id", existing.data.user.id);
      }
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

  // ── Merchant KYC upload ──────────────────────────────────────────

  app.post("/auth/kyc/upload", async (request, reply) => {
    const user = (request as unknown as { user?: { id: string; role: string } }).user;
    if (!user) return reply.status(401).send({ error: "Unauthorized" });

    const payload = request.body as {
      documentType: string;
      gstNumber?: string;
      panNumber?: string;
      businessName?: string;
      bankAccountNumber?: string;
      bankIfsc?: string;
      bankAccountName?: string;
    };

    // Update merchant record
    await app.supabase
      .from("merchants")
      .upsert({
        id: user.id,
        business_name: payload.businessName,
        gstin: payload.gstNumber,
        pan_number: payload.panNumber,
        bank_account_number: payload.bankAccountNumber,
        bank_ifsc: payload.bankIfsc,
        bank_account_name: payload.bankAccountName,
        onboarded_at: new Date().toISOString()
      });

    // Update profile KYC status
    await app.supabase
      .from("profiles")
      .update({ kyc_status: "pending" })
      .eq("id", user.id);

    return reply.status(200).send({
      kycStatus: "pending",
      message: "KYC documents submitted successfully. Review in progress."
    });
  });

  // ── Session resume/reconciliation ────────────────────────────────

  app.get("/sessions/active/reconcile", async (request, reply) => {
    const user = (request as unknown as { user?: { id: string } }).user;
    if (!user) return reply.status(401).send({ error: "Unauthorized" });

    const { SessionService } = await import("../services/session-service.js");
    const sessionService = new SessionService(app);
    const result = await sessionService.reconcileOnResume(user.id);
    return reply.send(result);
  });

  app.post("/sessions/:id/resume", async (request, reply) => {
    const user = (request as unknown as { user?: { id: string } }).user;
    if (!user) return reply.status(401).send({ error: "Unauthorized" });

    const { SessionService } = await import("../services/session-service.js");
    const sessionService = new SessionService(app);
    const sessionId = (request.params as { id: string }).id;
    const result = await sessionService.resumeSession(user.id, sessionId);
    return reply.send(result);
  });
};
