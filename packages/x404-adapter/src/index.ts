export interface IdentityResult {
  verified: boolean;
  reason?: string;
}

export interface AccessResult {
  allowed: boolean;
  reason?: string;
}

export interface MembershipTier {
  tier: "standard" | "silver" | "gold" | "premium";
}

export interface WalletHealth {
  healthy: boolean;
  reason?: string;
}

export interface BridgeParams {
  fromChain: string;
  toChain: string;
  asset: string;
  amount: string;
  walletAddress: string;
}

export interface BridgeResult {
  success: boolean;
  referenceId?: string;
}

export interface IX404Adapter {
  verifyIdentity(userId: string): Promise<IdentityResult>;
  checkAccess(userId: string, venueId: string): Promise<AccessResult>;
  getMembershipTier(userId: string): Promise<MembershipTier>;
  checkWalletHealth(walletAddress: string): Promise<WalletHealth>;
  bridgeAsset(params: BridgeParams): Promise<BridgeResult>;
}

export class NoopX404Adapter implements IX404Adapter {
  async verifyIdentity(): Promise<IdentityResult> {
    return { verified: true };
  }

  async checkAccess(): Promise<AccessResult> {
    return { allowed: true };
  }

  async getMembershipTier(): Promise<MembershipTier> {
    return { tier: "standard" };
  }

  async checkWalletHealth(): Promise<WalletHealth> {
    return { healthy: true };
  }

  async bridgeAsset(): Promise<BridgeResult> {
    return { success: true };
  }
}

export { LiveX404Adapter } from "./live-adapter.js";

export class X404AdapterRegistry {
  private readonly adapter: IX404Adapter;

  constructor(adapter?: IX404Adapter) {
    if (adapter) {
      this.adapter = adapter;
    } else if (
      process.env.X404_MODE === "enabled" &&
      process.env.X404_API_URL &&
      process.env.X404_API_KEY
    ) {
      const { LiveX404Adapter } = require("./live-adapter.js") as typeof import("./live-adapter.js");
      this.adapter = new LiveX404Adapter();
    } else {
      this.adapter = new NoopX404Adapter();
    }
  }

  getAdapter(): IX404Adapter {
    return this.adapter;
  }
}

