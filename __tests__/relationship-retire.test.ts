import { describe, it, expect, vi, beforeEach } from 'vitest';
import { retireIdentity, type RetirableIdentity } from '../lib/identity/retire';

/**
 * Builds a Supabase service-client mock that records the identities update
 * payload and the deletion_requests insert, with a configurable vendor contact.
 */
function makeSupabase(opts: { contact?: { privacy_email: string } | null } = {}) {
  const identityUpdate = vi.fn();
  const deletionInsert = vi.fn().mockResolvedValue({ error: null });
  const contact = opts.contact === undefined ? { privacy_email: 'privacy@vendor.com' } : opts.contact;

  const client = {
    from: (table: string) => {
      if (table === 'identities') {
        return {
          update: (payload: Record<string, unknown>) => {
            identityUpdate(payload);
            return {
              eq: () => ({ eq: () => Promise.resolve({ error: null }) }),
            };
          },
        };
      }
      if (table === 'company_privacy_contacts') {
        return {
          select: () => ({
            eq: () => ({ single: () => Promise.resolve({ data: contact, error: null }) }),
          }),
        };
      }
      if (table === 'deletion_requests') {
        return { insert: deletionInsert };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };

  return { client: client as never, identityUpdate, deletionInsert };
}

const baseIdentity: RetirableIdentity = {
  id: 'id-1',
  alias_email: 'abc@phantomdefender.com',
  service_label: 'Newsletter — example',
  vendor_domain: 'example.com',
  type: 'email',
  status: 'active',
  simplelogin_alias_id: null,
};

beforeEach(() => {
  delete process.env.SIMPLELOGIN_DB_URI;
});

describe('retireIdentity', () => {
  it('kill mode marks the identity killed and records a GDPR erasure', async () => {
    const { client, identityUpdate, deletionInsert } = makeSupabase();

    const result = await retireIdentity(client, {
      identity: baseIdentity,
      userId: 'user-1',
      mode: 'kill',
    });

    expect(result.newStatus).toBe('killed');
    expect(result.gdprRequestRecorded).toBe(true);

    const payload = identityUpdate.mock.calls[0][0];
    expect(payload.status).toBe('killed');
    expect(payload.reply_enabled).toBe(false);
    expect(payload.retired_at).toBeTruthy();
    expect(payload.is_honeypot).toBeUndefined();

    const deletion = deletionInsert.mock.calls[0][0];
    expect(deletion.company_email).toBe('privacy@vendor.com');
    expect(deletion.company_name).toBe('example.com');
    expect(deletion.request_type).toBe('gdpr_erasure');
    expect(deletion.identity_id).toBe('id-1');
  });

  it('honeypot mode keeps it alive as a tripwire and flips is_honeypot', async () => {
    const { client, identityUpdate } = makeSupabase();

    const result = await retireIdentity(client, {
      identity: baseIdentity,
      userId: 'user-1',
      mode: 'honeypot',
    });

    expect(result.newStatus).toBe('retired');
    const payload = identityUpdate.mock.calls[0][0];
    expect(payload.status).toBe('retired');
    expect(payload.is_honeypot).toBe(true);
    expect(payload.reply_enabled).toBe(false);
  });

  it('records no erasure when the vendor contact is unknown', async () => {
    const { client, deletionInsert } = makeSupabase({ contact: null });

    const result = await retireIdentity(client, {
      identity: baseIdentity,
      userId: 'user-1',
      mode: 'kill',
    });

    expect(result.gdprRequestRecorded).toBe(false);
    expect(deletionInsert).not.toHaveBeenCalled();
  });

  it('falls back to service_label when no vendor_domain was captured', async () => {
    const { client, deletionInsert } = makeSupabase();
    const legacy: RetirableIdentity = { ...baseIdentity, vendor_domain: null };

    const result = await retireIdentity(client, {
      identity: legacy,
      userId: 'user-1',
      mode: 'kill',
    });

    expect(result.gdprRequestRecorded).toBe(true);
    expect(deletionInsert.mock.calls[0][0].company_name).toBe('Newsletter — example');
  });

  it('records no erasure when there is no alias email (e.g. a phone identity)', async () => {
    const { client, deletionInsert } = makeSupabase();
    const phone: RetirableIdentity = {
      ...baseIdentity,
      type: 'phone',
      alias_email: null,
      vendor_domain: null,
      service_label: null,
    };

    const result = await retireIdentity(client, {
      identity: phone,
      userId: 'user-1',
      mode: 'kill',
    });

    expect(result.gdprRequestRecorded).toBe(false);
    expect(deletionInsert).not.toHaveBeenCalled();
  });
});
