import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Autopilot staleness scanning (shared by the manual scan route and the monthly
 * cron — v2-029 / v2-030).
 *
 * An identity is "stale" when it has seen no activity within the threshold:
 *   - email aliases: no email_summaries in `emailStaleDays` (default 90)
 *   - phone numbers: no sms_messages in `phoneStaleDays` (default 60)
 * Honeypots and identities the user has explicitly kept (autopilot_reviewed_at
 * set) are excluded.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface StaleIdentity {
  identity_id: string;
  reason: string;
}

export interface ScanIdentityRow {
  id: string;
  type: string;
  is_honeypot: boolean;
  autopilot_reviewed_at?: string | null;
}

export interface ScanOptions {
  emailStaleDays?: number;
  phoneStaleDays?: number;
}

export async function scanUserIdentities(
  supabase: SupabaseClient,
  userId: string,
  now: Date,
  options: ScanOptions = {}
): Promise<{ stale: StaleIdentity[]; totalScanned: number }> {
  const emailStaleDays = options.emailStaleDays ?? 90;
  const phoneStaleDays = options.phoneStaleDays ?? 60;
  const emailCutoff = new Date(now.getTime() - emailStaleDays * DAY_MS).toISOString();
  const phoneCutoff = new Date(now.getTime() - phoneStaleDays * DAY_MS).toISOString();

  const { data: identities } = await supabase
    .from('identities')
    .select('id, type, is_honeypot, autopilot_reviewed_at')
    .eq('user_id', userId)
    .eq('status', 'active');

  const rows = (identities ?? []) as ScanIdentityRow[];
  const scannable = rows.filter((i) => !i.is_honeypot && !i.autopilot_reviewed_at);

  const stale: StaleIdentity[] = [];
  for (const identity of scannable) {
    if (identity.type === 'phone') {
      const { count } = await supabase
        .from('sms_messages')
        .select('id', { count: 'exact', head: true })
        .eq('identity_id', identity.id)
        .gte('received_at', phoneCutoff);
      if ((count ?? 0) === 0) {
        stale.push({ identity_id: identity.id, reason: `No SMS received in ${phoneStaleDays} days` });
      }
    } else {
      const { count } = await supabase
        .from('email_summaries')
        .select('id', { count: 'exact', head: true })
        .eq('identity_id', identity.id)
        .gte('created_at', emailCutoff);
      if ((count ?? 0) === 0) {
        stale.push({ identity_id: identity.id, reason: `No emails received in ${emailStaleDays} days` });
      }
    }
  }

  return { stale, totalScanned: scannable.length };
}
