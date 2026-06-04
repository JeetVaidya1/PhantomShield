import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

interface State {
  users: Array<{ user_id: string; autopilot_mode: string; autopilot_auto_kill_days: number }>;
  identities: Array<{ id: string; type: string; is_honeypot: boolean; autopilot_reviewed_at: string | null }>;
  emailCount: number;
  smsCount: number;
}

let state: State;
const scanInsertSpy = vi.fn();
const killUpdateSpy = vi.fn();

vi.mock('../lib/supabase', () => ({
  getSupabaseClient: () => ({ auth: { getUser: vi.fn() } }),
  getSupabaseServiceClient: () => ({
    from: (table: string) => {
      if (table === 'user_settings') {
        return { select: () => ({ eq: () => Promise.resolve({ data: state.users, error: null }) }) };
      }
      if (table === 'identities') {
        return {
          select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: state.identities, error: null }) }) }),
          update: (patch: unknown) => ({
            in: (_c: string, ids: unknown) => ({
              eq: (_c2: string, uid: unknown) => {
                killUpdateSpy(patch, ids, uid);
                return Promise.resolve({ error: null });
              },
            }),
          }),
        };
      }
      if (table === 'email_summaries') {
        return { select: () => ({ eq: () => ({ gte: () => Promise.resolve({ count: state.emailCount }) }) }) };
      }
      if (table === 'sms_messages') {
        return { select: () => ({ eq: () => ({ gte: () => Promise.resolve({ count: state.smsCount }) }) }) };
      }
      if (table === 'autopilot_scans') {
        return { insert: (row: unknown) => { scanInsertSpy(row); return Promise.resolve({ error: null }); } };
      }
      // audit_log and any other table: accept inserts silently.
      return { insert: () => Promise.resolve({ error: null }) };
    },
  }),
}));

const pushMock = vi.fn().mockResolvedValue({ sent: true });
vi.mock('../lib/notifications/push', () => ({ sendPushNotification: (...a: unknown[]) => pushMock(...a) }));

import { POST } from '../app/api/cron/autopilot/route';

function cronReq(auth = 'Bearer the-secret') {
  return new Request('http://localhost/api/cron/autopilot', { method: 'POST', headers: { authorization: auth } });
}

describe('v2-030: Autopilot monthly cron', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 'the-secret');
    scanInsertSpy.mockClear();
    killUpdateSpy.mockClear();
    pushMock.mockClear();
    state = {
      users: [],
      identities: [{ id: 'id-1', type: 'email', is_honeypot: false, autopilot_reviewed_at: null }],
      emailCount: 0, // stale
      smsCount: 0,
    };
  });
  afterEach(() => vi.unstubAllEnvs());

  it('rejects without a valid CRON_SECRET', async () => {
    const res = await POST(cronReq('Bearer wrong'));
    expect(res.status).toBe(401);
  });

  it('manual mode: notifies, kills nothing', async () => {
    state.users = [{ user_id: 'u1', autopilot_mode: 'manual', autopilot_auto_kill_days: 90 }];
    const res = await POST(cronReq());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ processed: 1, notified: 1, killed: 0 });
    expect(killUpdateSpy).not.toHaveBeenCalled();
    expect(pushMock).toHaveBeenCalledWith('u1', expect.objectContaining({ title: expect.stringContaining('Privacy Cleanup') }));
  });

  it('auto-kill mode: kills stale aliases and sends a summary push', async () => {
    state.users = [{ user_id: 'u2', autopilot_mode: 'auto_kill', autopilot_auto_kill_days: 60 }];
    const res = await POST(cronReq());
    const json = await res.json();
    expect(json).toMatchObject({ processed: 1, killed: 1 });
    expect(killUpdateSpy).toHaveBeenCalledWith({ status: 'killed' }, ['id-1'], 'u2');
    expect(pushMock).toHaveBeenCalledWith('u2', expect.objectContaining({ body: expect.stringContaining('Auto-killed') }));
  });

  it('records a scan per user', async () => {
    state.users = [{ user_id: 'u1', autopilot_mode: 'manual', autopilot_auto_kill_days: 90 }];
    await POST(cronReq());
    expect(scanInsertSpy).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u1', stale_count: 1 }));
  });
});
