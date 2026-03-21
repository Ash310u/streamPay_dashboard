import Redis from "ioredis";
import { env } from "./env.js";

export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 1
});

redis.on("error", () => {
  // Local dev is allowed to boot without Redis; route-level operations will surface failures.
});

type CacheEntry = {
  value: string;
  expiresAt: number | null;
};

const memoryCache = new Map<string, CacheEntry>();

const cleanupMemoryKey = (key: string) => {
  const entry = memoryCache.get(key);
  if (entry?.expiresAt && entry.expiresAt <= Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return entry ?? null;
};

export const redisGet = async (key: string): Promise<string | null> => {
  try {
    return await redis.get(key);
  } catch {
    return cleanupMemoryKey(key)?.value ?? null;
  }
};

export const redisSetValue = async (
  key: string,
  value: string,
  options?: { ttlSeconds?: number; nx?: boolean }
): Promise<"OK" | null> => {
  const ttlSeconds = options?.ttlSeconds;
  const nx = options?.nx ?? false;

  try {
    if (nx && ttlSeconds) {
      return await redis.set(key, value, "EX", ttlSeconds, "NX");
    }

    if (nx) {
      return await redis.set(key, value, "NX");
    }

    if (ttlSeconds) {
      return await redis.set(key, value, "EX", ttlSeconds);
    }

    return await redis.set(key, value);
  } catch {
    const existing = cleanupMemoryKey(key);
    if (nx && existing) {
      return null;
    }

    memoryCache.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null
    });
    return "OK";
  }
};

export const redisDelete = async (key: string): Promise<number> => {
  try {
    return await redis.del(key);
  } catch {
    const existed = memoryCache.delete(key);
    return existed ? 1 : 0;
  }
};

