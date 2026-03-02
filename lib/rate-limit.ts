import { logAudit } from './audit';

interface RateLimitConfig {
  limit: number;
  windowMs: number;
  keyType: 'user' | 'ip';
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (Vercel Edge compatible — per-instance)
const store = new Map<string, RateLimitEntry>();

// Predefined limit configs from ARCHITECTURE-V2-FINAL.md Section 10D
export const RATE_LIMITS = {
  api: { limit: 100, windowMs: 60_000, keyType: 'user' as const },
  webhook: { limit: 1000, windowMs: 60_000, keyType: 'ip' as const },
  aiSummary: { limit: 100, windowMs: 86_400_000, keyType: 'user' as const },
  gdprSend: { limit: 10, windowMs: 86_400_000, keyType: 'user' as const },
  nuke: { limit: 1, windowMs: 86_400_000, keyType: 'user' as const },
  aliasCreation: { limit: 20, windowMs: 3_600_000, keyType: 'user' as const },
  phonePurchase: { limit: 5, windowMs: 86_400_000, keyType: 'user' as const },
  honeypotCreation: { limit: 5, windowMs: 86_400_000, keyType: 'user' as const },
  companyScorePublic: { limit: 60, windowMs: 60_000, keyType: 'ip' as const },
  authSignup: { limit: 5, windowMs: 3_600_000, keyType: 'ip' as const },
  authLogin: { limit: 10, windowMs: 900_000, keyType: 'ip' as const },
} as const;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number | null;
}

export function rateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const storeKey = `${config.keyType}:${key}`;

  const entry = store.get(storeKey);

  if (!entry || now >= entry.resetAt) {
    store.set(storeKey, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, remaining: config.limit - 1, retryAfterMs: null };
  }

  if (entry.count >= config.limit) {
    const retryAfterMs = entry.resetAt - now;
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: config.limit - entry.count,
    retryAfterMs: null,
  };
}

// Cleanup expired entries periodically
export function cleanupStore(): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) {
      store.delete(key);
    }
  }
}

// For testing
export function resetStore(): void {
  store.clear();
}

export function rateLimitResponse(result: RateLimitResult): Response | null {
  if (result.allowed) return null;

  const retryAfterSeconds = Math.ceil((result.retryAfterMs || 1000) / 1000);
  return new Response(
    JSON.stringify({ error: 'Too Many Requests', retryAfter: retryAfterSeconds }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfterSeconds),
      },
    }
  );
}

export async function checkRateLimit(params: {
  key: string;
  config: RateLimitConfig;
  userId?: string;
  action?: string;
}): Promise<RateLimitResult> {
  const result = rateLimit(params.key, params.config);

  if (!result.allowed && params.userId && params.action) {
    await logAudit({
      userId: params.userId,
      action: 'rate_limit_hit',
      metadata: { endpoint: params.action, key: params.key },
      success: false,
    });
  }

  return result;
}
