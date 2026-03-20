import type { FastifyInstance } from "fastify";
import { ApiError } from "../lib/api-error.js";

const DEFAULT_TOPUP_RATE = 83.25;

export class WalletService {
  constructor(private readonly app: FastifyInstance) {}

  async getWalletByUser(userId: string) {
    const { data, error } = await this.app.supabase.from("wallets").select("*").eq("user_id", userId).maybeSingle();

    if (error || !data) {
      throw new ApiError(404, "Wallet not found");
    }

    return data;
  }

  async listTransactions(userId: string) {
    const wallet = await this.getWalletByUser(userId);
    const { data, error } = await this.app.supabase
      .from("wallet_transactions")
      .select("*")
      .eq("wallet_id", wallet.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw new ApiError(400, error.message);
    }

    return data ?? [];
  }

  async creditTopUp(params: {
    userId: string;
    inrAmount: number;
    exchangeRate?: number;
    paymentId?: string;
  }) {
    const wallet = await this.getWalletByUser(params.userId);
    const exchangeRate = params.exchangeRate ?? DEFAULT_TOPUP_RATE;
    const cryptoAmount = Number((params.inrAmount / exchangeRate).toFixed(8));
    const nextCryptoBalance = Number(wallet.balance_crypto) + cryptoAmount;
    const nextInrBalance = Number(wallet.balance_inr_equivalent) + params.inrAmount;

    const [updatedWallet, transactionResult] = await Promise.all([
      this.app.supabase
        .from("wallets")
        .update({
          balance_crypto: nextCryptoBalance,
          balance_inr_equivalent: nextInrBalance
        })
        .eq("id", wallet.id)
        .select("*")
        .single(),
      this.app.supabase.from("wallet_transactions").insert({
        wallet_id: wallet.id,
        type: "top_up",
        inr_amount: params.inrAmount,
        crypto_amount: cryptoAmount,
        exchange_rate: exchangeRate,
        rate_locked_at: new Date().toISOString(),
        razorpay_payment_id: params.paymentId,
        status: "success"
      })
    ]);

    if (updatedWallet.error) {
      throw new ApiError(400, updatedWallet.error.message);
    }

    if (transactionResult.error) {
      throw new ApiError(400, transactionResult.error.message);
    }

    return updatedWallet.data;
  }

  async debitForSession(params: {
    userId: string;
    inrAmount: number;
    cryptoAmount: number;
    exchangeRate: number;
    sessionId: string;
  }) {
    const wallet = await this.getWalletByUser(params.userId);

    if (Number(wallet.balance_inr_equivalent) < params.inrAmount) {
      throw new ApiError(409, "Insufficient wallet balance for settlement");
    }

    const nextCryptoBalance = Number(wallet.balance_crypto) - params.cryptoAmount;
    const nextInrBalance = Number(wallet.balance_inr_equivalent) - params.inrAmount;

    const [updatedWallet, transactionResult] = await Promise.all([
      this.app.supabase
        .from("wallets")
        .update({
          balance_crypto: Number(nextCryptoBalance.toFixed(8)),
          balance_inr_equivalent: Number(nextInrBalance.toFixed(2))
        })
        .eq("id", wallet.id)
        .select("*")
        .single(),
      this.app.supabase.from("wallet_transactions").insert({
        wallet_id: wallet.id,
        type: "session_debit",
        inr_amount: params.inrAmount,
        crypto_amount: params.cryptoAmount,
        exchange_rate: params.exchangeRate,
        rate_locked_at: new Date().toISOString(),
        razorpay_payment_id: params.sessionId,
        status: "success"
      })
    ]);

    if (updatedWallet.error) {
      throw new ApiError(400, updatedWallet.error.message);
    }

    if (transactionResult.error) {
      throw new ApiError(400, transactionResult.error.message);
    }

    return updatedWallet.data;
  }
}

