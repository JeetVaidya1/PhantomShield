import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Email digest batching engine (v2-021).
 *
 * Runs hourly. For each user in 'digest' mode whose configured digest time
 * matches the current hour (and weekday, for weekly digests), it compiles all
 * un-forwarded marketing-email summaries into one digest batch, formats a clean
 * HTML email, and marks those summaries as forwarded.
 */

export interface DigestSettings {
  user_id: string;
  email_forward_mode: string;
  digest_frequency: string; // 'daily' | 'weekly'
  digest_time: string | null; // 'HH:MM' or 'HH:MM:SS'
  digest_day: number | null; // 0-6 (Sun-Sat) for weekly
}

export interface EmailSummaryRow {
  id: string;
  email_from: string;
  email_subject: string;
  summary: string | null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Parse the hour component from a 'HH:MM[:SS]' string; null if invalid. */
export function parseDigestHour(time: string | null): number | null {
  if (!time) return null;
  const hour = Number(time.split(':')[0]);
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : null;
}

/** Is a user's digest due at `now` (UTC hour, and weekday for weekly mode)? */
export function isDigestDue(settings: DigestSettings, now: Date): boolean {
  if (settings.email_forward_mode !== 'digest') return false;

  const dueHour = parseDigestHour(settings.digest_time);
  if (dueHour === null || now.getUTCHours() !== dueHour) return false;

  if (settings.digest_frequency === 'weekly') {
    return now.getUTCDay() === (settings.digest_day ?? 1);
  }
  return true;
}

/** Format the digest body: one line per email with subject + AI summary. */
export function formatDigestHtml(summaries: EmailSummaryRow[]): string {
  const rows = summaries
    .map(
      (s) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #eee;">
          <div style="font-weight:600;">${escapeHtml(s.email_subject)}</div>
          <div style="color:#666;font-size:13px;">${escapeHtml(s.email_from)}</div>
          <div style="color:#333;font-size:14px;margin-top:4px;">${escapeHtml(s.summary ?? '')}</div>
        </td>
      </tr>`
    )
    .join('');

  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;">
    <h2>Your Phantom Defender digest</h2>
    <p style="color:#666;">${summaries.length} message${summaries.length === 1 ? '' : 's'} since your last digest.</p>
    <table style="width:100%;border-collapse:collapse;">${rows}</table>
  </body></html>`;
}

/**
 * Deliver a compiled digest body via the configured outgoing mail relay
 * (SimpleLogin's DKIM-signing SMTP, fronted by an HTTP relay on the VPS).
 * Best-effort and gated on DIGEST_RELAY_URL — never throws, so a relay outage
 * can't abort the cron. Returns whether delivery was attempted.
 */
export async function deliverDigest(userId: string, html: string): Promise<{ delivered: boolean }> {
  const relayUrl = process.env.DIGEST_RELAY_URL;
  if (!relayUrl) {
    // No relay configured (e.g. local/dev): the batch is still recorded.
    return { delivered: false };
  }
  try {
    const res = await fetch(relayUrl, {
      method: 'POST',
      signal: AbortSignal.timeout(10000),
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.DIGEST_RELAY_SECRET ?? ''}`,
      },
      body: JSON.stringify({ user_id: userId, html }),
    });
    return { delivered: res.ok };
  } catch {
    return { delivered: false };
  }
}

/**
 * Compile and "send" a digest for one user. Returns whether a digest was sent
 * and how many emails it contained. Users with no pending emails are skipped.
 */
export async function processDigestForUser(
  supabase: SupabaseClient,
  settings: DigestSettings,
  now: Date
): Promise<{ sent: boolean; emailCount: number }> {
  const { data: pending } = await supabase
    .from('email_summaries')
    .select('id, email_from, email_subject, summary')
    .eq('user_id', settings.user_id)
    .eq('forwarded', false)
    .is('digest_batch_id', null)
    .eq('email_type', 'marketing');

  const summaries = (pending ?? []) as EmailSummaryRow[];
  if (summaries.length === 0) {
    return { sent: false, emailCount: 0 };
  }

  const { data: batch, error: batchError } = await supabase
    .from('digest_batches')
    .insert({
      user_id: settings.user_id,
      email_count: summaries.length,
      scheduled_for: now.toISOString(),
      sent: true,
      sent_at: now.toISOString(),
    })
    .select()
    .single();

  // If we couldn't record the batch, do NOT mark the summaries forwarded —
  // otherwise they'd be silently lost. Leave them for the next cron tick.
  if (batchError || !batch?.id) {
    return { sent: false, emailCount: 0 };
  }
  const batchId = batch.id as string;

  // Hand the compiled digest body to the mail relay (SimpleLogin's outgoing
  // SMTP, DKIM-signed). Delivery is best-effort and gated on a configured relay.
  const html = formatDigestHtml(summaries);
  await deliverDigest(settings.user_id, html);

  await supabase
    .from('email_summaries')
    .update({ forwarded: true, digest_batch_id: batchId })
    .in(
      'id',
      summaries.map((s) => s.id)
    );

  return { sent: true, emailCount: summaries.length };
}

/** Process digests for all due users. */
export async function runDigestCron(
  supabase: SupabaseClient,
  now: Date
): Promise<{ processed: number; sent: number; skipped: number }> {
  const { data: settingsRows } = await supabase
    .from('user_settings')
    .select('user_id, email_forward_mode, digest_frequency, digest_time, digest_day')
    .eq('email_forward_mode', 'digest');

  const allSettings = (settingsRows ?? []) as DigestSettings[];
  const due = allSettings.filter((s) => isDigestDue(s, now));

  let sent = 0;
  let skipped = 0;
  for (const settings of due) {
    const result = await processDigestForUser(supabase, settings, now);
    if (result.sent) sent++;
    else skipped++;
  }

  return { processed: due.length, sent, skipped };
}
