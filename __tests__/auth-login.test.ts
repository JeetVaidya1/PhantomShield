import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase
const mockSignInWithPassword = vi.fn();
const mockFrom = vi.fn(() => ({ insert: vi.fn().mockResolvedValue({ error: null }) }));

vi.mock('../lib/supabase', () => ({
  getSupabaseClient: () => ({
    auth: { signInWithPassword: mockSignInWithPassword },
  }),
  getSupabaseServiceClient: () => ({
    from: mockFrom,
  }),
}));

// Mock audit
vi.mock('../lib/audit', () => ({
  logAudit: vi.fn(),
}));

import { POST } from '../app/api/auth/login/route';
import { resetStore } from '../lib/rate-limit';

function makeRequest(body: Record<string, unknown>, ip = '127.0.0.1') {
  return new Request('http://localhost/api/auth/login', {
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
};

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();

    mockSignInWithPassword.mockResolvedValue({
      data: {
        user: {
          id: 'user-uuid-123',
          user_metadata: {
            username: 'testuser',
            encryption_salt: 'a'.repeat(64),
            key_check: 'encrypted-check-value',
          },
        },
        session: {
          access_token: 'jwt-token',
          refresh_token: 'refresh-token',
          expires_at: 1700000000,
        },
      },
      error: null,
    });
  });

  it('authenticates and returns session with user metadata', async () => {
    const res = await POST(makeRequest(validBody));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.user.id).toBe('user-uuid-123');
    expect(data.user.username).toBe('testuser');
    expect(data.user.encryption_salt).toBe('a'.repeat(64));
    expect(data.user.key_check).toBe('encrypted-check-value');
    expect(data.session.access_token).toBe('jwt-token');
  });

  it('passes synthetic email to Supabase', async () => {
    await POST(makeRequest(validBody));

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'testuser@phantom.local',
      password: 'strongpassword123',
    });
  });

  it('lowercases username', async () => {
    await POST(makeRequest({ ...validBody, username: 'TestUser' }));

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'testuser@phantom.local',
      password: 'strongpassword123',
    });
  });

  it('returns 401 for invalid credentials', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' },
    });

    const res = await POST(makeRequest(validBody));
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe('Invalid username or password');
  });

  it('rejects missing username', async () => {
    const res = await POST(makeRequest({ password: 'strongpassword123' }));
    expect(res.status).toBe(400);
  });

  it('rejects short password', async () => {
    const res = await POST(makeRequest({ username: 'testuser', password: 'short' }));
    expect(res.status).toBe(400);
  });

  it('rejects invalid username characters', async () => {
    const res = await POST(
      makeRequest({ username: 'user name!', password: 'strongpassword123' })
    );
    expect(res.status).toBe(400);
  });

  it('rate limits after 10 requests from same IP', async () => {
    for (let i = 0; i < 10; i++) {
      await POST(makeRequest(validBody, '10.0.0.1'));
    }

    const res = await POST(makeRequest(validBody, '10.0.0.1'));
    expect(res.status).toBe(429);
  });

  it('allows requests from different IPs independently', async () => {
    for (let i = 0; i < 10; i++) {
      await POST(makeRequest(validBody, '10.0.0.1'));
    }

    const res = await POST(makeRequest(validBody, '10.0.0.2'));
    expect(res.status).toBe(200);
  });

  it('handles missing user_metadata gracefully', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: {
        user: {
          id: 'user-uuid-123',
          user_metadata: {},
        },
        session: {
          access_token: 'jwt-token',
          refresh_token: 'refresh-token',
          expires_at: 1700000000,
        },
      },
      error: null,
    });

    const res = await POST(makeRequest(validBody));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.user.username).toBe('testuser');
    expect(data.user.encryption_salt).toBeNull();
    expect(data.user.key_check).toBeNull();
  });
});
