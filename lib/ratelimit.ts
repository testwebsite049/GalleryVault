import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const hasRedis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;

interface LocalLimitRecord {
  count: number;
  expiresAt: number;
}

// Local in-memory store fallback for development
const localStore = new Map<string, LocalLimitRecord>();

// Clean up expired items periodically to prevent memory leaks
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of localStore.entries()) {
      if (value.expiresAt < now) {
        localStore.delete(key);
      }
    }
  }, 5 * 60 * 1000); // Every 5 minutes
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // timestamp in ms
}

export async function rateLimit(
  ip: string,
  key: string,
  limit: number,
  durationSeconds: number
): Promise<RateLimitResult> {
  if (hasRedis) {
    try {
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      });

      const limiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(limit, `${durationSeconds} s`),
        analytics: true,
      });

      const identifier = `${key}:${ip}`;
      const result = await limiter.limit(identifier);

      return {
        success: result.success,
        limit: result.limit,
        remaining: result.remaining,
        reset: result.reset,
      };
    } catch (err) {
      console.warn("Upstash Redis connection failed, falling back to local memory limit store:", err);
    }
  }

  // Local memory store implementation
  const now = Date.now();
  const storeKey = `${key}:${ip}`;
  const record = localStore.get(storeKey);

  if (record && record.expiresAt > now) {
    if (record.count >= limit) {
      return {
        success: false,
        limit,
        remaining: 0,
        reset: record.expiresAt,
      };
    }
    
    record.count += 1;
    return {
      success: true,
      limit,
      remaining: Math.max(0, limit - record.count),
      reset: record.expiresAt,
    };
  } else {
    const expiresAt = now + durationSeconds * 1000;
    localStore.set(storeKey, { count: 1, expiresAt });
    
    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: expiresAt,
    };
  }
}
export default rateLimit;
