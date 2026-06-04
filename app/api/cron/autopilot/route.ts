import { getSupabaseServiceClient } from '@/lib/supabase';
import { verifyCronSecret } from '@/lib/webhooks/verify';
import { scanUserIdentities } from '@/lib/autopilot/scan';
import { sendPushNotification } from '@/lib/notifications/push';
import { logAudit } from '@/lib/audit';
import type { SupabaseClient } from '@supabase/supabase-js';

const BATCH_SIZE = 100;
const AUTOPILOT_DEEP_LINK = 'phantomdefender://autopilot/review';

interface AutopilotUser {
  user_id: string;
  autopilot_mode: string | null;
  autopilot_auto_kill_days: number | null;
}

/**
 * POST /api/cron/autopilot (v2-030) — runs monthly for all autopilot-enabled
 * users. Manual mode notifies; auto-kill mode kills stale identities past the
 * threshold and sends a summary. Users are processed in batches of 100.
 */
export async function POST(request: Request) {
  try {
    const authorization = request.headers.get('authorization') || '';
    if (!verifyCronSecret({ authorization })) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseServiceClient();
    const now = new Date();

    const { data: settingsRows } = await supabase
      .from('user_settings')
      .select('user_id, autopilot_mode, autopilot_auto_kill_days')
      .eq('autopilot_enabled', true);

    const users = (settingsRows ?? []) as AutopilotUser[];

    let notified = 0;
    let killed = 0;
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map((u) => processAutopilotUser(supabase, u, now))
      );
      for (const r of results) {
        notified += r.notified;
        killed += r.killed;
      }
    }

    return Response.json({ processed: users.length, notified, killed });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function processAutopilotUser(
  supabase: SupabaseClient,
  user: AutopilotUser,
  now: Date
): Promise<{ notified: number; killed: number }> {
  const autoKill = user.autopilot_mode === 'auto_kill';
  const threshold = user.autopilot_auto_kill_days ?? 90;

  const { stale } = await scanUserIdentities(supabase, user.user_id, now, {
    emailStaleDays: autoKill ? threshold : 90,
  });

  // Persist the scan so the review screen and kill endpoint can reference it.
  await supabase.from('autopilot_scans').insert({
    user_id: user.user_id,
    stale_count: stale.length,
    stale_identities: stale,
    auto_killed: autoKill ? stale.length : 0,
  });

  if (stale.length === 0) {
    return { notified: 0, killed: 0 };
  }

  if (!autoKill) {
    await sendPushNotification(user.user_id, {
      title: '🧹 Privacy Cleanup',
      body: `${stale.length} stale ${stale.length === 1 ? 'identity' : 'identities'} found. Review?`,
      deepLink: AUTOPILOT_DEEP_LINK,
    });
    return { notified: 1, killed: 0 };
  }

  // Auto-kill mode: deactivate each stale identity (scoped to the user).
  // Use the same 'deactivated' status as the manual autopilot/kill and nuke
  // paths so the review UI shows consistent state regardless of trigger.
  const ids = stale.map((s) => s.identity_id);
  await supabase
    .from('identities')
    .update({ status: 'deactivated' })
    .in('id', ids)
    .eq('user_id', user.user_id);

  await logAudit({
    userId: user.user_id,
    action: 'autopilot_auto_killed',
    resourceType: 'identities',
    metadata: { count: ids.length, threshold_days: threshold },
  });

  await sendPushNotification(user.user_id, {
    title: 'Privacy Autopilot',
    body: `Auto-killed ${ids.length} stale ${ids.length === 1 ? 'alias' : 'aliases'} this month`,
    deepLink: AUTOPILOT_DEEP_LINK,
  });

  return { notified: 1, killed: ids.length };
}
