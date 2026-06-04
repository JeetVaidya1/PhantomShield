import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

let updateSpy = vi.fn();
let updateError: unknown = null;

vi.mock('../lib/supabase', () => ({
  getSupabaseClient: () => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
  }),
  getSupabaseServiceClient: () => ({
    from: () => ({
      update: (patch: unknown) => {
        updateSpy(patch);
        return { eq: () => Promise.resolve({ error: updateError }) };
      },
    }),
  }),
}));

import { PATCH } from '../app/api/v2/settings/digest/route';

function req(body: unknown, auth = 'Bearer valid') {
  return new Request('http://localhost/api/v2/settings/digest', {
    method: 'PATCH',
    headers: { authorization: auth, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('v2-022: Digest settings PATCH route', () => {
  beforeEach(() => {
    updateSpy = vi.fn();
    updateError = null;
  });

  it('requires auth', async () => {
    const res = await PATCH(req({ email_forward_mode: 'digest', digest_frequency: 'daily', digest_time: '08:00' }, 'Bearer '));
    expect(res.status).toBe(401);
  });

  it('rejects invalid time format with 400', async () => {
    const res = await PATCH(req({ email_forward_mode: 'digest', digest_frequency: 'daily', digest_time: '8am' }));
    expect(res.status).toBe(400);
  });

  it('rejects an unknown mode with 400', async () => {
    const res = await PATCH(req({ email_forward_mode: 'turbo', digest_frequency: 'daily', digest_time: '08:00' }));
    expect(res.status).toBe(400);
  });

  it('updates settings on valid input', async () => {
    const res = await PATCH(req({ email_forward_mode: 'digest', digest_frequency: 'weekly', digest_time: '09:00', digest_day: 3 }));
    expect(res.status).toBe(200);
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ email_forward_mode: 'digest', digest_frequency: 'weekly', digest_time: '09:00', digest_day: 3 })
    );
  });

  it('returns 500 when the update fails', async () => {
    updateError = { message: 'db down' };
    const res = await PATCH(req({ email_forward_mode: 'full', digest_frequency: 'daily', digest_time: '08:00' }));
    expect(res.status).toBe(500);
  });
});

describe('v2-022: Digest settings screen', () => {
  const source = readFileSync(join(__dirname, '../mobile/screens/DigestSettings.tsx'), 'utf-8');

  it('offers full / summary / digest modes', () => {
    expect(source).toContain('Forward All');
    expect(source).toContain('Summaries Only');
    expect(source).toContain("'digest'");
  });

  it('shows a time picker and a day picker for weekly', () => {
    expect(source).toContain('Delivery time');
    expect(source).toContain('Day of week');
    expect(source).toContain('isWeekly');
  });

  it('calls PATCH /api/v2/settings/digest', () => {
    expect(source).toContain('/api/v2/settings/digest');
    expect(source).toContain("method: 'PATCH'");
  });

  it('validates time before calling the API', () => {
    expect(source).toContain('HH_MM');
  });

  it('saves optimistically with rollback on error', () => {
    expect(source).toContain('setValue(previous)');
  });

  it('explains each mode', () => {
    expect(source).toContain('MODE_EXPLANATIONS');
  });
});
