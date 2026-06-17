import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';

const SECRET = 'sl-webhook-secret';

// Captured DB operations
const inserts: Record<string, unknown[]> = {};
const updates: Array<{ table: string; patch: Record<string, unknown> }> = [];
let aliasRow: Record<string, unknown> | null = null;

vi.mock('../lib/supabase', () => ({
  getSupabaseClient: () => ({ auth: { getUser: vi.fn() } }),
  getSupabaseServiceClient: () => ({
    from: (table: string) => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: aliasRow, error: aliasRow ? null : { message: 'not found' } }) }) }),
      insert: (row: unknown) => {
        (inserts[table] ??= []).push(row);
        return Promise.resolve({ error: null });
      },
      update: (patch: Record<string, unknown>) => {
        updates.push({ table, patch });
        return { eq: () => Promise.resolve({ error: null }) };
      },
    }),
  }),
}));

const pushMock = vi.fn().mockResolvedValue({ sent: true });
vi.mock('../lib/notifications/push', () => ({ sendPushNotification: (...a: unknown[]) => pushMock(...a) }));

import { POST } from '../app/api/webhooks/email-events/route';
import { resetStore } from '../lib/rate-limit';

function signedRequest(body: object, secret = SECRET) {
  const raw = JSON.stringify(body);
  const sig = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  return new Request('http://localhost/api/webhooks/email-events', {
    method: 'POST',
    headers: { 'x-simplelogin-signature': sig, 'content-type': 'application/json', 'x-forwarded-for': '5.5.5.5' },
    body: raw,
  });
}

describe('v2-014: Email events webhook', () => {
  beforeEach(() => {
    vi.stubEnv('SIMPLELOGIN_WEBHOOK_SECRET', SECRET);
    for (const k of Object.keys(inserts)) delete inserts[k];
    updates.length = 0;
    pushMock.mockClear();
    resetStore();
    aliasRow = { id: 'id-1', user_id: 'user-1', service_label: 'Netflix', bounce_count: 0 };
  });
  afterEach(() => vi.unstubAllEnvs());

  it('rejects an invalid signature with 401', async () => {
    const req = signedRequest({ event_type: 'forwarded', alias_email: 'a@x.com' }, 'wrong-secret');
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('forwarded event creates a tracker_log record', async () => {
    const req = signedRequest({
      event_type: 'forwarded',
      alias_email: 'a@x.com',
      from: 'news@netflix.com',
      trackers_stripped: 4,
      links_cleaned: 2,
      subject: 'Hi',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(inserts.tracker_logs).toHaveLength(1);
    expect(inserts.tracker_logs[0]).toMatchObject({ identity_id: 'id-1', trackers_stripped: 4 });
    // Sender matches the labeled service → no leak recorded.
    expect(inserts.leak_detections).toBeUndefined();
  });

  it('forwarded event from an unexpected sender records a leak', async () => {
    const req = signedRequest({
      event_type: 'forwarded',
      alias_email: 'a@x.com',
      from: 'spam@vitamins.example',
    });
    await POST(req);
    expect(inserts.leak_detections).toHaveLength(1);
    expect(inserts.leak_detections[0]).toMatchObject({ actual_sender_domain: 'vitamins.example' });
  });

  it('vendor_domain gives precise leak attribution (subdomain is not a leak)', async () => {
    aliasRow = { id: 'id-1', user_id: 'user-1', service_label: 'Acme', vendor_domain: 'acme.com', bounce_count: 0 };
    const ok = signedRequest({ event_type: 'forwarded', alias_email: 'a@x.com', from: 'no-reply@mail.acme.com' });
    await POST(ok);
    expect(inserts.leak_detections).toBeUndefined();

    const leak = signedRequest({ event_type: 'forwarded', alias_email: 'a@x.com', from: 'someone@databroker.io' });
    await POST(leak);
    expect(inserts.leak_detections).toHaveLength(1);
    expect(inserts.leak_detections[0]).toMatchObject({ expected_sender: 'acme.com', actual_sender_domain: 'databroker.io' });
  });

  it('a retired honeypot trips the wire instead of logging a leak', async () => {
    aliasRow = { id: 'id-1', user_id: 'user-1', service_label: 'Store', vendor_domain: 'store.com', is_honeypot: true, bounce_count: 0 };
    const req = signedRequest({
      event_type: 'forwarded',
      alias_email: 'a@x.com',
      from: 'promo@store.com',
      subject: 'Still here!',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(inserts.honeypot_triggers).toHaveLength(1);
    expect(inserts.honeypot_triggers[0]).toMatchObject({
      identity_id: 'id-1',
      trigger_from_domain: 'store.com',
      trigger_subject: 'Still here!',
    });
    // Tripwire short-circuits: no leak record even though it's the vendor itself.
    expect(inserts.leak_detections).toBeUndefined();
    expect(pushMock).toHaveBeenCalledWith('user-1', expect.objectContaining({ title: 'Caught one' }));
  });

  it('3 hard bounces auto-disables the alias and sends a push', async () => {
    aliasRow = { id: 'id-1', user_id: 'user-1', service_label: 'Netflix', bounce_count: 2 };
    const req = signedRequest({ event_type: 'bounced', alias_email: 'a@x.com', bounce_type: 'hard' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const disable = updates.find((u) => u.patch.status === 'disabled');
    expect(disable?.patch).toMatchObject({ bounce_count: 3, status: 'disabled' });
    expect(pushMock).toHaveBeenCalledWith('user-1', expect.objectContaining({ priority: 'high' }));
  });

  it('a soft bounce does not disable the alias', async () => {
    aliasRow = { id: 'id-1', user_id: 'user-1', service_label: 'Netflix', bounce_count: 2 };
    const req = signedRequest({ event_type: 'bounced', alias_email: 'a@x.com', bounce_type: 'soft' });
    await POST(req);
    expect(updates.find((u) => u.patch.status === 'disabled')).toBeUndefined();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('alias_disabled event updates status and pushes', async () => {
    const req = signedRequest({ event_type: 'alias_disabled', alias_email: 'a@x.com' });
    await POST(req);
    expect(updates.find((u) => u.patch.status === 'disabled')).toBeTruthy();
    expect(pushMock).toHaveBeenCalled();
  });
});
