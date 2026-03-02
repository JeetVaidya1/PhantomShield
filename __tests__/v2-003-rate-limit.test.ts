import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockInsert = vi.fn().mockResolvedValue({ error: null });
vi.mock('../lib/supabase', () => ({
  getSupabaseServiceClient: () => ({
    from: () => ({ insert: mockInsert }),
  }),
}));

import {
  rateLimit,
  resetStore,
  RATE_LIMITS,
  rateLimitResponse,
  checkRateLimit,
} from '../lib/rate-limit';

describe('v2-003: Rate limiting middleware', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it('exports rateLimit function with configurable limits', () => {
    expect(typeof rateLimit).toBe('function');
    expect(RATE_LIMITS.api).toEqual({ limit: 100, windowMs: 60_000, keyType: 'user' });
  });

  it('supports per-user limits', () => {
    const config = { limit: 3, windowMs: 60_000, keyType: 'user' as const };

    const r1 = rateLimit('user-1', config);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = rateLimit('user-1', config);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = rateLimit('user-1', config);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);

    const r4 = rateLimit('user-1', config);
    expect(r4.allowed).toBe(false);
    expect(r4.retryAfterMs).toBeGreaterThan(0);
  });

  it('supports per-IP limits', () => {
    const config = { limit: 2, windowMs: 60_000, keyType: 'ip' as const };

    rateLimit('1.2.3.4', config);
    rateLimit('1.2.3.4', config);
    const result = rateLimit('1.2.3.4', config);
    expect(result.allowed).toBe(false);
  });

  it('supports daily limits', () => {
    const config = { limit: 1, windowMs: 86_400_000, keyType: 'user' as const };

    const r1 = rateLimit('user-1', config);
    expect(r1.allowed).toBe(true);

    const r2 = rateLimit('user-1', config);
    expect(r2.allowed).toBe(false);
    expect(r2.retryAfterMs).toBeGreaterThan(0);
    expect(r2.retryAfterMs!).toBeLessThanOrEqual(86_400_000);
  });

  it('returns 429 with Retry-After header when exceeded', () => {
    const failedResult = {
      allowed: false,
      remaining: 0,
      retryAfterMs: 30_000,
    };

    const response = rateLimitResponse(failedResult);
    expect(response).not.toBeNull();
    expect(response!.status).toBe(429);
    expect(response!.headers.get('Retry-After')).toBe('30');
  });

  it('returns null response when allowed', () => {
    const okResult = { allowed: true, remaining: 5, retryAfterMs: null };
    expect(rateLimitResponse(okResult)).toBeNull();
  });

  it('rapid calls beyond limit return 429', () => {
    const config = { limit: 5, windowMs: 60_000, keyType: 'user' as const };

    for (let i = 0; i < 5; i++) {
      expect(rateLimit('rapid-user', config).allowed).toBe(true);
    }

    const blocked = rateLimit('rapid-user', config);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('different users have independent counters', () => {
    const config = { limit: 1, windowMs: 60_000, keyType: 'user' as const };

    expect(rateLimit('user-A', config).allowed).toBe(true);
    expect(rateLimit('user-A', config).allowed).toBe(false);

    // User B should still be allowed
    expect(rateLimit('user-B', config).allowed).toBe(true);
  });

  it('logs rate limit hits to audit_log', async () => {
    const config = { limit: 1, windowMs: 60_000, keyType: 'user' as const };

    await checkRateLimit({ key: 'audit-user', config, userId: 'audit-user', action: '/api/test' });
    // First call allowed, no audit
    expect(mockInsert).not.toHaveBeenCalled();

    await checkRateLimit({ key: 'audit-user', config, userId: 'audit-user', action: '/api/test' });
    // Second call blocked, should audit
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'audit-user',
        action: 'rate_limit_hit',
        success: false,
      })
    );
  });

  it('has all predefined limit configs', () => {
    expect(RATE_LIMITS.api.limit).toBe(100);
    expect(RATE_LIMITS.webhook.limit).toBe(1000);
    expect(RATE_LIMITS.aiSummary.limit).toBe(100);
    expect(RATE_LIMITS.gdprSend.limit).toBe(10);
    expect(RATE_LIMITS.nuke.limit).toBe(1);
    expect(RATE_LIMITS.aliasCreation.limit).toBe(20);
    expect(RATE_LIMITS.phonePurchase.limit).toBe(5);
  });
});
