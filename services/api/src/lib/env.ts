import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  APP_BASE_URL: z.url(),
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // Razorpay
  RAZORPAY_KEY_ID: z.string().default(""),
  RAZORPAY_KEY_SECRET: z.string().default(""),
  RAZORPAY_WEBHOOK_SECRET: z.string().default(""),
  RAZORPAY_ACCOUNT_NUMBER: z.string().default(""),
  // Platform
  PLATFORM_FEE_RATE: z.coerce.number().default(0.005),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  SESSION_BILLING_PROVIDER: z.enum(["ledger", "superfluid"]).default("ledger"),
  // X404
  X404_MODE: z.enum(["noop", "enabled"]).default("noop"),
  X404_API_URL: z.string().default(""),
  X404_API_KEY: z.string().default(""),
  // LLM (OpenAI-compatible)
  LLM_API_URL: z.string().default(""),
  LLM_API_KEY: z.string().default(""),
  // CoinGecko
  COINGECKO_API_KEY: z.string().default(""),
  // Superfluid
  SUPERFLUID_HOST_ADDRESS: z.string().default(""),
  SUPERFLUID_PRIVATE_KEY: z.string().default(""),
  POLYGON_RPC_URL: z.string().default(""),
  MERCHANT_REGISTRY_ADDRESS: z.string().default(""),
  SESSION_MANAGER_ADDRESS: z.string().default(""),
  SETTLEMENT_ANCHOR_ADDRESS: z.string().default(""),
  CHAIN_FALLBACK_PAYOUT_ADDRESS: z.string().default(""),
  // Notifications
  RESEND_API_KEY: z.string().default(""),
  EXPO_ACCESS_TOKEN: z.string().default(""),
  // Observability
  SENTRY_DSN: z.string().default(""),
});

export const env = envSchema.parse(process.env);

