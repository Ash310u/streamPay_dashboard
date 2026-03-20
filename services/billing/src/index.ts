import { calculateCharge, type BillingProvider } from "@detrix/billing-core";
import { BlockchainAdapterService } from "@detrix/blockchain-adapter";
import type { ChargeSnapshot, FinalSettlement, RefundResult, Session, StreamHandle } from "@detrix/shared-types";
import { randomUUID } from "node:crypto";

export class InternalLedgerBillingProvider implements BillingProvider {
  private readonly streams = new Map<string, { startedAt: number; lockedRate: number; rateCrypto: number }>();

  constructor(
    private readonly config: {
      defaultLockedRate: number;
      rateCrypto: number;
      billingUnit: "per_second" | "per_minute" | "per_hour";
      minimumChargeInr: number;
      maximumCapInr?: number | null;
      baseFeeInr?: number;
      platformFeeRate: number;
    }
  ) {}

  async startStream(): Promise<StreamHandle> {
    const streamId = randomUUID();
    this.streams.set(streamId, {
      startedAt: Date.now(),
      lockedRate: this.config.defaultLockedRate,
      rateCrypto: this.config.rateCrypto
    });

    return {
      streamId,
      provider: "ledger",
      startedAt: new Date().toISOString()
    };
  }

  async stopStream(handle: StreamHandle): Promise<FinalSettlement> {
    const snapshot = await this.getCurrentCharge(handle);
    this.streams.delete(handle.streamId);

    return {
      cryptoAmount: snapshot.cryptoAmount,
      grossInr: snapshot.inrAmount,
      feeInr: Number((snapshot.inrAmount * this.config.platformFeeRate).toFixed(2)),
      netMerchantInr: Number((snapshot.inrAmount * (1 - this.config.platformFeeRate)).toFixed(2)),
      stoppedAt: new Date().toISOString()
    };
  }

  async getCurrentCharge(handle: StreamHandle): Promise<ChargeSnapshot> {
    const stream = this.streams.get(handle.streamId);

    if (!stream) {
      throw new Error(`Unknown stream ${handle.streamId}`);
    }

    const elapsedSeconds = Math.max(1, Math.floor((Date.now() - stream.startedAt) / 1000));
    const settlement = calculateCharge({
      elapsedSeconds,
      billingUnit: this.config.billingUnit,
      rateCrypto: stream.rateCrypto,
      lockedRate: stream.lockedRate,
      minimumChargeInr: this.config.minimumChargeInr,
      maximumCapInr: this.config.maximumCapInr,
      baseFeeInr: this.config.baseFeeInr,
      platformFeeRate: this.config.platformFeeRate
    });

    return {
      cryptoAmount: settlement.cryptoAmount,
      inrAmount: settlement.grossInr,
      elapsedSeconds,
      lockedRate: stream.lockedRate
    };
  }

  async refund(_session: Session, amount: number): Promise<RefundResult> {
    return {
      refundId: randomUUID(),
      amountInr: amount,
      amountCrypto: Number((amount / this.config.defaultLockedRate).toFixed(8)),
      status: "queued"
    };
  }
}

export class SuperfluidBillingProvider implements BillingProvider {
  constructor(
    private readonly deps: {
      blockchainAdapter: BlockchainAdapterService;
      merchantId: (session: Session) => string;
      venueId: (session: Session) => string;
      userId: (session: Session) => string;
      pricingPlanId: (session: Session) => string;
      merchantPayoutAddress: (session: Session) => string;
      estimateCurrentCharge: (handle: StreamHandle) => Promise<ChargeSnapshot>;
    }
  ) {}

  async startStream(session: Session): Promise<StreamHandle> {
    const streamId = `sf_${session.id}_${Date.now()}`;
    await this.deps.blockchainAdapter.startSessionStream({
      session,
      merchantId: this.deps.merchantId(session),
      venueId: this.deps.venueId(session),
      userId: this.deps.userId(session),
      pricingPlanId: this.deps.pricingPlanId(session),
      streamReference: streamId
    });

    return {
      streamId,
      provider: "superfluid",
      startedAt: new Date().toISOString()
    };
  }

  async stopStream(handle: StreamHandle): Promise<FinalSettlement> {
    const charge = await this.deps.estimateCurrentCharge(handle);
    const finalSettlement: FinalSettlement = {
      cryptoAmount: charge.cryptoAmount,
      grossInr: charge.inrAmount,
      feeInr: Number((charge.inrAmount * Number(process.env.PLATFORM_FEE_RATE ?? 0.005)).toFixed(2)),
      netMerchantInr: Number((charge.inrAmount * (1 - Number(process.env.PLATFORM_FEE_RATE ?? 0.005))).toFixed(2)),
      stoppedAt: new Date().toISOString()
    };

    await this.deps.blockchainAdapter.closeSessionStream({
      sessionId: handle.streamId.replace(/^sf_/, "").split("_")[0] ?? handle.streamId,
      sessionHash: JSON.stringify(finalSettlement)
    });

    return finalSettlement;
  }

  async getCurrentCharge(handle: StreamHandle): Promise<ChargeSnapshot> {
    return this.deps.estimateCurrentCharge(handle);
  }

  async refund(_session: Session, amount: number): Promise<RefundResult> {
    return {
      refundId: randomUUID(),
      amountInr: amount,
      amountCrypto: 0,
      status: "queued"
    };
  }
}

export class BillingService {
  constructor(private readonly provider: BillingProvider) {}

  start(session: Session) {
    return this.provider.startStream(session);
  }

  stop(handle: StreamHandle) {
    return this.provider.stopStream(handle);
  }

  getCurrentCharge(handle: StreamHandle) {
    return this.provider.getCurrentCharge(handle);
  }
}

export const createConfiguredBillingProvider = (config: {
  mode: "ledger" | "superfluid";
  ledger: ConstructorParameters<typeof InternalLedgerBillingProvider>[0];
  superfluid?: ConstructorParameters<typeof SuperfluidBillingProvider>[0];
}): BillingProvider => {
  if (config.mode === "superfluid") {
    if (!config.superfluid) {
      throw new Error("Superfluid billing mode selected without blockchain adapter dependencies");
    }

    return new SuperfluidBillingProvider(config.superfluid);
  }

  return new InternalLedgerBillingProvider(config.ledger);
};

export class FiatCryptoBridgeService {
  constructor(
    private readonly deps: {
      fetchRate: (symbol: "USDC" | "MATIC") => Promise<number>;
    }
  ) {}

  async convertInrToCrypto(amountInr: number, symbol: "USDC" | "MATIC") {
    const rate = await this.deps.fetchRate(symbol);
    const cryptoAmount = Number((amountInr / rate).toFixed(8));

    return {
      symbol,
      rate,
      cryptoAmount
    };
  }

  async convertCryptoToInr(amountCrypto: number, symbol: "USDC" | "MATIC") {
    const rate = await this.deps.fetchRate(symbol);

    return {
      symbol,
      rate,
      inrAmount: Number((amountCrypto * rate).toFixed(2))
    };
  }

  hasRateCircuitBroken(startRate: number, latestRate: number): boolean {
    const change = Math.abs((latestRate - startRate) / startRate);
    return change > 0.1;
  }
}
