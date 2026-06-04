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
        return {
          eq: () => Promise.resolve({ error: updateError }),
          in: () => ({ eq: () => Promise.resolve({ error: updateError }) }),
        };
      },
      upsert: (row: unknown) => {
        updateSpy(row);
        return Promise.resolve({ error: updateError });
      },
    }),
  }),
}));

import { PATCH } from '../app/api/v2/settings/autopilot/route';
import { POST as keep } from '../app/api/v2/autopilot/keep/route';

function patchReq(body: unknown) {
  return new Request('http://localhost/x', {
    method: 'PATCH',
    headers: { authorization: 'Bearer v', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}
function postReq(body: unknown) {
  return new Request('http://localhost/x', {
    method: 'POST',
    headers: { authorization: 'Bearer v', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const UUID = '550e8400-e29b-41d4-a716-446655440001';

describe('v2-031: autopilot settings + keep routes', () => {
  beforeEach(() => {
    updateSpy = vi.fn();
    updateError = null;
  });

  it('PATCH validates the threshold (only 30/60/90)', async () => {
    const res = await PATCH(patchReq({ autopilot_enabled: true, autopilot_mode: 'auto_kill', autopilot_auto_kill_days: 45 }));
    expect(res.status).toBe(400);
  });

  it('PATCH saves valid autopilot settings', async () => {
    const res = await PATCH(patchReq({ autopilot_enabled: true, autopilot_mode: 'manual', autopilot_auto_kill_days: 60 }));
    expect(res.status).toBe(200);
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ autopilot_enabled: true, autopilot_mode: 'manual', autopilot_auto_kill_days: 60 }));
  });

  it('keep marks identities reviewed (excluded from future scans)', async () => {
    const res = await keep(postReq({ identity_ids: [UUID] }));
    expect(res.status).toBe(200);
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ autopilot_reviewed_at: expect.any(String) }));
  });

  it('keep rejects non-uuid ids', async () => {
    const res = await keep(postReq({ identity_ids: ['nope'] }));
    expect(res.status).toBe(400);
  });
});

describe('v2-031: AutopilotSettings screen', () => {
  const source = readFileSync(join(__dirname, '../mobile/screens/AutopilotSettings.tsx'), 'utf-8');

  it('has an enable toggle and manual/auto-kill mode selector', () => {
    expect(source).toContain('Enable Autopilot');
    expect(source).toContain('Manual Review');
    expect(source).toContain('Auto-Kill');
  });

  it('has a 30/60/90 threshold picker', () => {
    expect(source).toContain('THRESHOLDS');
    expect(source).toContain('[30, 60, 90]');
  });

  it('has a manual scan trigger', () => {
    expect(source).toContain('Run Scan Now');
    expect(source).toContain('onScan');
  });

  it('calls PATCH /api/v2/settings/autopilot', () => {
    expect(source).toContain('/api/v2/settings/autopilot');
  });
});

describe('v2-031: AutopilotReview screen', () => {
  const source = readFileSync(join(__dirname, '../mobile/screens/AutopilotReview.tsx'), 'utf-8');

  it('shows each stale identity with reason and last activity', () => {
    expect(source).toContain('item.reason');
    expect(source).toContain('last_activity');
  });

  it('has per-identity Kill (with confirmation) and Keep', () => {
    expect(source).toContain('handleKill');
    expect(source).toContain('handleKeep');
    expect(source).toContain('Kill identity?');
    expect(source).toContain('/api/v2/autopilot/kill');
    expect(source).toContain('/api/v2/autopilot/keep');
  });

  it('shows footprint reduction percentage after review', () => {
    expect(source).toContain('footprintReduction');
    expect(source).toContain('Reduced footprint by');
  });
});
