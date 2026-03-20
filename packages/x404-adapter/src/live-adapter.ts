import { env } from "../lib/env.js";
import { logger } from "../lib/logger.js";
import type {
  IX404Adapter,
  IdentityResult,
  AccessResult,
  MembershipTier,
  WalletHealth,
  BridgeParams,
  BridgeResult
} from "./index.js";

/**
 * Live X404 adapter — calls the real X404 REST API.
 * All methods degrade gracefully: on network error or missing config they
 * return the same permissive defaults as NoopX404Adapter so the system
 * degrades without crashing.
 */
export class LiveX404Adapter implements IX404Adapter {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.baseUrl = env.X404_API_URL.replace(/\/$/, "");
    this.apiKey = env.X404_API_KEY;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T | null> {
    if (!this.baseUrl || !this.apiKey) {
      logger.warn({ msg: "x404_not_configured" });
      return null;
    }

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          ...(init?.headers ?? {})
        }
      });

      if (!res.ok) {
        logger.warn({ msg: "x404_request_failed", path, status: res.status });
        return null;
      }

      return res.json() as Promise<T>;
    } catch (err) {
      logger.warn({ msg: "x404_request_error", path, err: String(err) });
      return null;
    }
  }

  async verifyIdentity(userId: string): Promise<IdentityResult> {
    const result = await this.request<IdentityResult>("/identity/verify", {
      method: "POST",
      body: JSON.stringify({ userId })
    });
    return result ?? { verified: true };
  }

  async checkAccess(userId: string, venueId: string): Promise<AccessResult> {
    const result = await this.request<AccessResult>("/access/check", {
      method: "POST",
      body: JSON.stringify({ userId, venueId })
    });
    return result ?? { allowed: true };
  }

  async getMembershipTier(userId: string): Promise<MembershipTier> {
    const result = await this.request<MembershipTier>(`/membership/${encodeURIComponent(userId)}`);
    return result ?? { tier: "standard" };
  }

  async checkWalletHealth(walletAddress: string): Promise<WalletHealth> {
    const result = await this.request<WalletHealth>(
      `/wallet/${encodeURIComponent(walletAddress)}/health`
    );
    return result ?? { healthy: true };
  }

  async bridgeAsset(params: BridgeParams): Promise<BridgeResult> {
    const result = await this.request<BridgeResult>("/bridge", {
      method: "POST",
      body: JSON.stringify(params)
    });
    return result ?? { success: true };
  }
}
