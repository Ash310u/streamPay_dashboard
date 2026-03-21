import { Contract, JsonRpcProvider, Wallet, keccak256, toUtf8Bytes } from "ethers";
import type { FinalSettlement, Session } from "@detrix/shared-types";

const merchantRegistryAbi = [
  "function registerMerchant(bytes32 merchantId, address payoutAddress, bytes32 metadataHash)",
  "function updatePayoutAddress(bytes32 merchantId, address payoutAddress)"
];

const sessionManagerAbi = [
  "function startSession(bytes32 sessionId, bytes32 merchantId, bytes32 venueId, bytes32 userId, bytes32 pricingPlanId, string streamReference)",
  "function closeSession(bytes32 sessionId, bytes32 sessionHash)",
  "function flagDispute(bytes32 sessionId, bytes32 disputeHash)"
];

const settlementAnchorAbi = [
  "function anchorSession(bytes32 sessionId, bytes32 sessionHash, bytes32 merchantId, bytes32 venueId, address merchantPayoutAddress, uint256 grossAmount, uint256 operatorFeeAmount)",
  "function flagDispute(bytes32 sessionId, bytes32 disputeReference)"
];

export interface BlockchainAdapterConfig {
  rpcUrl: string;
  privateKey: string;
  merchantRegistryAddress: string;
  sessionManagerAddress: string;
  settlementAnchorAddress: string;
}

export interface StartStreamInput {
  session: Session;
  merchantId: string;
  venueId: string;
  userId: string;
  pricingPlanId: string;
  streamReference: string;
}

export class BlockchainAdapterService {
  private readonly provider: JsonRpcProvider;
  private readonly signer: Wallet;
  private readonly merchantRegistry: Contract;
  private readonly sessionManager: Contract;
  private readonly settlementAnchor: Contract;

  constructor(private readonly config: BlockchainAdapterConfig) {
    this.provider = new JsonRpcProvider(config.rpcUrl);
    this.signer = new Wallet(config.privateKey, this.provider);
    this.merchantRegistry = new Contract(config.merchantRegistryAddress, merchantRegistryAbi, this.signer);
    this.sessionManager = new Contract(config.sessionManagerAddress, sessionManagerAbi, this.signer);
    this.settlementAnchor = new Contract(config.settlementAnchorAddress, settlementAnchorAbi, this.signer);
  }

  private hashId(value: string) {
    return keccak256(toUtf8Bytes(value));
  }

  private getMerchantRegistryMethod(name: "registerMerchant" | "updatePayoutAddress") {
    return this.merchantRegistry[name] as (...args: unknown[]) => Promise<{ wait: () => Promise<unknown> }>;
  }

  private getSessionManagerMethod(name: "startSession" | "closeSession" | "flagDispute") {
    return this.sessionManager[name] as (...args: unknown[]) => Promise<{ wait: () => Promise<unknown> }>;
  }

  private getSettlementAnchorMethod(name: "anchorSession" | "flagDispute") {
    return this.settlementAnchor[name] as (...args: unknown[]) => Promise<{ wait: () => Promise<unknown> }>;
  }

  async registerMerchant(params: { merchantId: string; payoutAddress: string; metadataHash: string }) {
    const registerMerchant = this.getMerchantRegistryMethod("registerMerchant");
    const tx = await registerMerchant(
      this.hashId(params.merchantId),
      params.payoutAddress,
      this.hashId(params.metadataHash)
    );

    return tx.wait();
  }

  async startSessionStream(input: StartStreamInput) {
    const startSession = this.getSessionManagerMethod("startSession");
    const tx = await startSession(
      this.hashId(input.session.id),
      this.hashId(input.merchantId),
      this.hashId(input.venueId),
      this.hashId(input.userId),
      this.hashId(input.pricingPlanId),
      input.streamReference
    );

    return tx.wait();
  }

  async closeSessionStream(input: {
    sessionId: string;
    sessionHash: string;
  }) {
    const closeSession = this.getSessionManagerMethod("closeSession");
    const tx = await closeSession(this.hashId(input.sessionId), this.hashId(input.sessionHash));
    return tx.wait();
  }

  async anchorSettlement(input: {
    sessionId: string;
    merchantId: string;
    venueId: string;
    merchantPayoutAddress: string;
    grossAmountInMinorUnits: bigint;
    operatorFeeInMinorUnits: bigint;
    finalSettlement: FinalSettlement;
  }) {
    const settlementHash = this.hashId(JSON.stringify(input.finalSettlement));
    const anchorSession = this.getSettlementAnchorMethod("anchorSession");
    const tx = await anchorSession(
      this.hashId(input.sessionId),
      settlementHash,
      this.hashId(input.merchantId),
      this.hashId(input.venueId),
      input.merchantPayoutAddress,
      input.grossAmountInMinorUnits,
      input.operatorFeeInMinorUnits
    );

    return tx.wait();
  }

  async flagDispute(input: { sessionId: string; disputeReference: string }) {
    const sessionIdHash = this.hashId(input.sessionId);
    const disputeHash = this.hashId(input.disputeReference);
    const flagSessionDispute = this.getSessionManagerMethod("flagDispute");
    const flagSettlementDispute = this.getSettlementAnchorMethod("flagDispute");
    const [sessionTx, settlementTx] = await Promise.all([
      flagSessionDispute(sessionIdHash, disputeHash),
      flagSettlementDispute(sessionIdHash, disputeHash)
    ]);

    return Promise.all([sessionTx.wait(), settlementTx.wait()]);
  }
}
