import type { getSupabaseServiceClient } from '@/lib/supabase';

/**
 * Retire a single relationship (identity) cleanly — the per-vendor exit door.
 *
 * This is the routine that used to live inline inside the global emergency
 * nuke. It is shared so both the global nuke (retire everything) and the
 * per-relationship "I'm done with this" action run identical, audited logic.
 *
 * Two modes:
 *  - 'kill'     : burn it. Stop forwarding, mark killed. You are gone.
 *  - 'honeypot' : leave a tripwire. Keep the alias alive but flip it to a
 *                 honeypot, so if the vendor ignores the deletion request or
 *                 sold the address on, the next email they send is caught.
 *
 * Both modes record a GDPR/CCPA erasure request when the vendor's privacy
 * contact is known. Honeypot mode is the sharper move: you demand deletion
 * AND watch whether they comply.
 */

type ServiceClient = ReturnType<typeof getSupabaseServiceClient>;

export type RetireMode = 'kill' | 'honeypot';
export type DeletionRequestType = 'gdpr_erasure' | 'ccpa_deletion';

export interface RetirableIdentity {
  id: string;
  alias_email: string | null;
  service_label: string | null;
  vendor_domain?: string | null;
  type?: string | null;
  status?: string | null;
  simplelogin_alias_id?: number | null;
}

export interface RetireParams {
  identity: RetirableIdentity;
  userId: string;
  mode: RetireMode;
  requestType?: DeletionRequestType;
}

export interface RetireResult {
  identityId: string;
  mode: RetireMode;
  newStatus: 'killed' | 'retired';
  gdprRequestRecorded: boolean;
}

const GDPR_RESPONSE_WINDOW_DAYS = 30;

/**
 * The key we look a vendor up by in company_privacy_contacts. The captured
 * vendor_domain is authoritative; we fall back to a normalized service_label
 * for relationships created before domain capture existed.
 */
function vendorLookupKey(identity: RetirableIdentity): string | null {
  if (identity.vendor_domain) {
    return identity.vendor_domain.toLowerCase().trim();
  }
  if (identity.service_label) {
    return identity.service_label.toLowerCase().trim();
  }
  return null;
}

/** Human-facing vendor name for the deletion record. */
function vendorDisplayName(identity: RetirableIdentity): string {
  return identity.vendor_domain || identity.service_label || 'Unknown service';
}

/**
 * Stop a SimpleLogin alias from forwarding. Dynamically imported and env-gated
 * so neither the Postgres pool nor the bridge loads unless it's configured.
 */
async function stopForwarding(simpleloginAliasId: number | null | undefined): Promise<void> {
  if (!process.env.SIMPLELOGIN_DB_URI || !simpleloginAliasId) return;
  const { deactivateAlias } = await import('@/lib/email/alias-sync');
  await deactivateAlias(Number(simpleloginAliasId));
}

/**
 * Record a GDPR/CCPA erasure request for a retired relationship, matching the
 * record-only semantics of the deletion-requests endpoint (the email body is
 * dispatched downstream). Returns whether a request was recorded.
 */
async function recordErasureRequest(
  supabase: ServiceClient,
  identity: RetirableIdentity,
  userId: string,
  requestType: DeletionRequestType
): Promise<boolean> {
  const key = vendorLookupKey(identity);
  if (!key || !identity.alias_email) return false;

  const { data: contact } = await supabase
    .from('company_privacy_contacts')
    .select('privacy_email')
    .eq('company_domain', key)
    .single();

  if (!contact?.privacy_email) return false;

  const sentAt = new Date();
  const responseDeadline = new Date(sentAt);
  responseDeadline.setDate(responseDeadline.getDate() + GDPR_RESPONSE_WINDOW_DAYS);

  const { error } = await supabase.from('deletion_requests').insert({
    user_id: userId,
    identity_id: identity.id,
    company_name: vendorDisplayName(identity),
    company_email: contact.privacy_email,
    request_type: requestType,
    status: 'sent',
    sent_at: sentAt.toISOString(),
    response_deadline: responseDeadline.toISOString(),
  });

  // Don't claim an erasure was recorded if the insert failed.
  return !error;
}

export async function retireIdentity(
  supabase: ServiceClient,
  params: RetireParams
): Promise<RetireResult> {
  const { identity, userId, mode, requestType = 'gdpr_erasure' } = params;
  const retiredAt = new Date().toISOString();

  // 'kill' fully burns the alias; 'honeypot' keeps it receiving as a tripwire.
  const newStatus: 'killed' | 'retired' = mode === 'kill' ? 'killed' : 'retired';

  // 'kill' deactivates the SimpleLogin alias so it stops receiving entirely.
  // 'honeypot' intentionally leaves SimpleLogin active so the tripwire keeps
  // receiving; delivery to the user is suppressed by the forward-policy layer
  // (shouldForward returns false for a retired relationship), not here.
  if (mode === 'kill') {
    await stopForwarding(identity.simplelogin_alias_id);
  }

  const { error: updateError } = await supabase
    .from('identities')
    .update({
      status: newStatus,
      retired_at: retiredAt,
      reply_enabled: false,
      ...(mode === 'honeypot' ? { is_honeypot: true } : {}),
    })
    .eq('id', identity.id)
    .eq('user_id', userId);

  // A swallowed failure here would falsely report the relationship retired and
  // still record a deletion request — surface it so the caller returns 500.
  if (updateError) {
    throw new Error(`Failed to retire identity ${identity.id}: ${updateError.message}`);
  }

  const gdprRequestRecorded = await recordErasureRequest(
    supabase,
    identity,
    userId,
    requestType
  );

  return { identityId: identity.id, mode, newStatus, gdprRequestRecorded };
}
