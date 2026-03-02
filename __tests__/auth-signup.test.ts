import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase
const mockCreateUser = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockFrom = vi.fn(() => ({ insert: vi.fn().mockResolvedValue({ error: null }) }));

vi.mock('../lib/supabase', () => ({
  getSupabaseServiceClient: () => ({
    auth: { admin: { createUser: mockCreateUser } },
    from: mockFrom,
  }),
  getSupabaseClient: () => ({
    auth: { signInWithPassword: mockSignInWithPassword },
  }),
}));

// Mock audit (don't need real audit logging in tests)
vi.mock('../lib/audit', () => ({
  logAudit: vi.fn(),
}));

import { POST } from '../app/api/auth/signup/route';
import { resetStore } from '../lib/rate-limit';

function makeRequest(body: Record<string, unknown>, ip = '127.0.0.1') {
  return new Request('http://localhost/api/auth/signup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  });
}

const validBody = {
  username: 'testuser',
  password: 'strongpassword123',
  encryption_salt: 'a'.repeat(64),
  key_check: 'some-key-check-value',
};

describe('POST /api/auth/signup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();

    mockCreateUser.mockResolvedValue({
      data: { user: { id: 'user-uuid-123' } },
      error: null,
    });

    mockSignInWithPassword.mockResolvedValue({
      data: {
        user: { id: 'user-uuid-123', user_metadata: { username: 'testuser' } },
        session: {
          access_token: 'jwt-token',
          refresh_token: 'refresh-token',
          expires_at: 1700000000,
        },
      },
      error: null,
    });
  });

  it('creates a user and returns session', async () => {
    const res = await POST(makeRequest(validBody));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.user.id).toBe('user-uuid-123');
    expect(data.user.username).toBe('testuser');
    expect(data.session.access_token).toBe('jwt-token');
    expect(data.session.refresh_token).toBe('refresh-token');
  });

  it('passes synthetic email to Supabase', async () => {
    await POST(makeRequest(validBody));

    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'testuser@phantom.local',
        password: 'strongpassword123',
        email_confirm: true,
        user_metadata: {
          username: 'testuser',
          encryption_salt: 'a'.repeat(64),
          key_check: 'some-key-check-value',
        },
      })
    );
  });

  it('lowercases username', async () => {
    await POST(makeRequest({ ...validBody, username: 'TestUser' }));

    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'testuser@phantom.local',
      })
    );
  });

  it('rejects missing username', async () => {
    const { username: _, ...body } = validBody;
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
  });

  it('rejects short username', async () => {
    const res = await POST(makeRequest({ ...validBody, username: 'ab' }));
    expect(res.status).toBe(400);
  });

  it('rejects invalid username characters', async () => {
    const res = await POST(makeRequest({ ...validBody, username: 'user name!' }));
    expect(res.status).toBe(400);
  });

  it('rejects short password', async () => {
    const res = await POST(makeRequest({ ...validBody, password: 'short' }));
    expect(res.status).toBe(400);
  });

  it('rejects invalid encryption_salt (not hex)', async () => {
    const res = await POST(
      makeRequest({ ...validBody, encryption_salt: 'not-hex' })
    );
    expect(res.status).toBe(400);
  });

  it('rejects missing key_check', async () => {
    const { key_check: _, ...body } = validBody;
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
  });

  it('returns 409 for duplicate username', async () => {
    mockCreateUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'User already been registered' },
    });

    const res = await POST(makeRequest(validBody));
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toBe('Username already taken');
  });

  it('returns 500 for unexpected Supabase error', async () => {
    mockCreateUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Internal error' },
    });

    const warnSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
    warnSpy.mockRestore();
  });

  it('handles auto-signin failure gracefully', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Sign in failed' },
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(makeRequest(validBody));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.user.id).toBe('user-uuid-123');
    expect(data.session).toBeNull();
    consoleSpy.mockRestore();
  });

  it('rate limits after 5 requests from same IP', async () => {
    for (let i = 0; i < 5; i++) {
      await POST(makeRequest(validBody, '10.0.0.1'));
    }

    const res = await POST(makeRequest(validBody, '10.0.0.1'));
    expect(res.status).toBe(429);
  });

  it('allows requests from different IPs', async () => {
    for (let i = 0; i < 5; i++) {
      await POST(makeRequest(validBody, `10.0.0.${i}`));
    }

    const res = await POST(makeRequest(validBody, '10.0.0.99'));
    expect(res.status).toBe(201);
  });
});
