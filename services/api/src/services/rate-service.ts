import type { FastifyInstance } from "fastify";
import { ApiError } from "../lib/api-error.js";
import { redis } from "../lib/redis.js";

const SYMBOL_MAP = {
  USDC: "usd-coin",
  MATIC: "matic-network"
} as const;

type SupportedSymbol = keyof typeof SYMBOL_MAP;

export class RateService {
  constructor(private readonly _app: FastifyInstance) {}

  async getInrRate(symbol: SupportedSymbol): Promise<number> {
    const cacheKey = `rate:${symbol}:inr`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      return Number(cached);
    }

    const coinId = SYMBOL_MAP[symbol];
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=inr`;
    const response = await fetch(url, {
      headers: process.env.COINGECKO_API_KEY ? { "x-cg-demo-api-key": process.env.COINGECKO_API_KEY } : undefined
    });

    if (!response.ok) {
      throw new ApiError(502, `CoinGecko rate fetch failed for ${symbol}`);
    }

    const payload = (await response.json()) as Record<string, { inr?: number }>;
    const rate = payload[coinId]?.inr;

    if (!rate) {
      throw new ApiError(502, `CoinGecko did not return INR rate for ${symbol}`);
    }

    await redis.set(cacheKey, String(rate), "EX", 60);
    return rate;
  }

  isCircuitBroken(startRate: number, latestRate: number) {
    const drift = Math.abs((latestRate - startRate) / startRate);
    return drift > 0.1;
  }
}

