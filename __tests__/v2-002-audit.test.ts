import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase before importing audit
const mockInsert = vi.fn();
const mockFrom = vi.fn(() => ({ insert: mockInsert }));

vi.mock('../lib/supabase', () => ({
  getSupabaseServiceClient: () => ({
    from: mockFrom,
  }),
}));

import { logAudit } from '../lib/audit';

describe('v2-002: Audit logging middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue({ error: null });
  });

  it('exports logAudit function', () => {
    expect(typeof logAudit).toBe('function');
  });

  it('uses supabase service role client for insert', async () => {
    await logAudit({
      userId: 'user-123',
      action: 'test_action',
    });

    expect(mockFrom).toHaveBeenCalledWith('audit_log');
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it('extracts IP address from x-forwarded-for header', async () => {
    const mockHeaders = new Map([
      ['x-forwarded-for', '1.2.3.4, 5.6.7.8'],
      ['user-agent', 'TestAgent/1.0'],
    ]);

    await logAudit({
      userId: 'user-123',
      action: 'test_action',
      request: { headers: { get: (name: string) => mockHeaders.get(name) || null } },
    });

    const insertArg = mockInsert.mock.calls[0][0];
    expect(insertArg.ip_address).toBe('1.2.3.4');
  });

  it('falls back to x-real-ip header', async () => {
    const mockHeaders = new Map([
      ['x-real-ip', '10.0.0.1'],
      ['user-agent', 'TestAgent/1.0'],
    ]);

    await logAudit({
      userId: 'user-123',
      action: 'test_action',
      request: { headers: { get: (name: string) => mockHeaders.get(name) || null } },
    });

    const insertArg = mockInsert.mock.calls[0][0];
    expect(insertArg.ip_address).toBe('10.0.0.1');
  });

  it('extracts user-agent from request headers', async () => {
    const mockHeaders = new Map([
      ['user-agent', 'PhantomShield/2.0'],
    ]);

    await logAudit({
      userId: 'user-123',
      action: 'test_action',
      request: { headers: { get: (name: string) => mockHeaders.get(name) || null } },
    });

    const insertArg = mockInsert.mock.calls[0][0];
    expect(insertArg.user_agent).toBe('PhantomShield/2.0');
  });

  it('calling logAudit creates record with all fields populated', async () => {
    await logAudit({
      userId: 'user-abc',
      action: 'identity_created',
      resourceType: 'identity',
      resourceId: 'id-456',
      metadata: { label: 'Netflix' },
      success: true,
    });

    const insertArg = mockInsert.mock.calls[0][0];
    expect(insertArg).toEqual({
      user_id: 'user-abc',
      action: 'identity_created',
      resource_type: 'identity',
      resource_id: 'id-456',
      metadata: { label: 'Netflix' },
      ip_address: null,
      user_agent: null,
      success: true,
    });
  });

  it('logAudit with invalid user_id does not throw', async () => {
    mockInsert.mockResolvedValue({
      error: { message: 'foreign key violation' },
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(
      logAudit({ userId: 'invalid-uuid', action: 'test' })
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(
      '[audit] Failed to write audit log:',
      'foreign key violation'
    );
    warnSpy.mockRestore();
  });

  it('handles unexpected errors gracefully', async () => {
    mockInsert.mockRejectedValue(new Error('network error'));

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(
      logAudit({ userId: 'user-123', action: 'test' })
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('defaults success to true when not specified', async () => {
    await logAudit({ userId: 'user-123', action: 'test' });

    const insertArg = mockInsert.mock.calls[0][0];
    expect(insertArg.success).toBe(true);
  });
});
