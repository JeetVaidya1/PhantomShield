import { getSupabaseServiceClient } from '@/lib/supabase';
import { verifySimpleLoginWebhook } from '@/lib/webhooks/verify';
import { rateLimit, RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit';
import { checkForLeak } from '@/lib/email/leak-detector';
import { sendPushNotification } from '@/lib/notifications/push';
import { logAudit } from '@/lib/audit';

const HARD_BOUNCE_DISABLE_THRESHOLD = 3;

function lowerCaseHeaders(request: Request): Record<string, string> {
  const out: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

function senderDomainOf(email: string): string {
  const at = email.lastIndexOf('@');
  return at >= 0 ? email.slice(at + 1).toLowerCase() : '';
}

interface AliasRow {
  id: string;
  user_id: string;
  service_label: string | null;
  vendor_domain: string | null;
  is_honeypot: boolean | null;
  bounce_count: number | null;
}

/**
 * POST /api/webhooks/email-events (v2-014)
 *
 * SimpleLogin's job_runner posts events as emails are processed. We verify the
 * HMAC signature, then handle forwarded / bounced / alias_disabled events.
 * Responses never echo internal data.
 */
export async function POST(request: Request) {
  try {
    // Rate limit per source IP (1000/min).
    const ip = (request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
    const rl = rateLimit(ip, RATE_LIMITS.webhook);
    const limited = rateLimitResponse(rl);
    if (limited) return limited;

    const rawBody = await request.text();
    if (!verifySimpleLoginWebhook(lowerCaseHeaders(request), rawBody)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return Response.json({ error: 'Bad Request' }, { status: 400 });
    }

    const eventType = String(payload.event_type ?? '');
    const aliasEmail = String(payload.alias_email ?? '');
    if (!eventType || !aliasEmail) {
      return Response.json({ error: 'Bad Request' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();
    const { data: alias } = await supabase
      .from('identities')
      .select('id, user_id, service_label, vendor_domain, is_honeypot, bounce_count')
      .eq('alias_email', aliasEmail)
      .single();

    if (!alias) {
      // Acknowledge so SimpleLogin doesn't retry; reveal nothing.
      return Response.json({ received: true });
    }
    const identity = alias as AliasRow;

    switch (eventType) {
      case 'forwarded':
        await handleForwarded(identity, payload);
        break;
      case 'bounced':
        await handleBounced(identity, payload);
        break;
      case 'alias_disabled':
        await handleAliasDisabled(identity);
        break;
      default:
        // Unknown event: acknowledge without action.
        break;
    }

    return Response.json({ received: true });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleForwarded(identity: AliasRow, payload: Record<string, unknown>): Promise<void> {
  const supabase = getSupabaseServiceClient();
  const senderEmail = String(payload.from ?? payload.sender_email ?? '');
  const senderDomain = senderDomainOf(senderEmail);
  const trackersStripped = Number(payload.trackers_stripped ?? 0);

  await supabase.from('tracker_logs').insert({
    identity_id: identity.id,
    user_id: identity.user_id,
    trackers_stripped: trackersStripped,
    tracker_companies: (payload.tracker_companies as string[] | undefined) ?? [],
    links_cleaned: Number(payload.links_cleaned ?? 0),
    email_from: senderEmail || null,
    email_subject: (payload.subject as string | undefined) ?? null,
  });

  // A retired honeypot is a tripwire: any mail it receives means the vendor
  // ignored the deletion request or sold the address on. Catch them.
  if (identity.is_honeypot) {
    await supabase.from('honeypot_triggers').insert({
      identity_id: identity.id,
      user_id: identity.user_id,
      trigger_from_email: senderEmail || null,
      trigger_from_domain: senderDomain,
      trigger_subject: (payload.subject as string | undefined) ?? null,
    });
    await sendPushNotification(identity.user_id, {
      title: 'Caught one',
      body: `${senderDomain || 'A sender'} emailed an alias you retired — they ignored your deletion request.`,
      deepLink: 'phantomdefender://honeypots',
      priority: 'high',
    });
    return;
  }

  const leak = checkForLeak({
    serviceLabel: identity.service_label ?? '',
    vendorDomain: identity.vendor_domain,
    senderDomain,
    senderEmail,
  });

  if (leak.isLeak) {
    await supabase.from('leak_detections').insert({
      identity_id: identity.id,
      user_id: identity.user_id,
      expected_sender: identity.vendor_domain || identity.service_label || '',
      actual_sender_domain: senderDomain,
      actual_sender_email: senderEmail || null,
    });
  }
}

async function handleBounced(identity: AliasRow, payload: Record<string, unknown>): Promise<void> {
  const isHard = String(payload.bounce_type ?? '').toLowerCase() === 'hard';
  if (!isHard) return;

  const supabase = getSupabaseServiceClient();
  const newCount = (identity.bounce_count ?? 0) + 1;
  const shouldDisable = newCount >= HARD_BOUNCE_DISABLE_THRESHOLD;

  await supabase
    .from('identities')
    .update({
      bounce_count: newCount,
      ...(shouldDisable ? { status: 'disabled' } : {}),
    })
    .eq('id', identity.id);

  if (shouldDisable) {
    await logAudit({
      userId: identity.user_id,
      action: 'alias_auto_disabled',
      resourceType: 'identity',
      resourceId: identity.id,
      metadata: { reason: 'hard_bounces', bounce_count: newCount },
    });
    await sendPushNotification(identity.user_id, {
      title: 'Alias disabled',
      body: 'An alias was auto-disabled after repeated delivery failures.',
      deepLink: 'phantomdefender://aliases',
      priority: 'high',
    });
  }
}

async function handleAliasDisabled(identity: AliasRow): Promise<void> {
  const supabase = getSupabaseServiceClient();
  await supabase.from('identities').update({ status: 'disabled' }).eq('id', identity.id);
  await sendPushNotification(identity.user_id, {
    title: 'Alias disabled',
    body: 'One of your aliases was disabled.',
    deepLink: 'phantomdefender://aliases',
    priority: 'high',
  });
}
