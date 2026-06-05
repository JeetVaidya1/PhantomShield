import { classifyEmail } from '@/lib/email/classifier';
import { summarizeEmail } from '@/lib/email/summarizer';
import { checkRateLimit, RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { shouldForward, type MutePolicy } from '@/lib/email/forward-policy';

const RETIRED_STATUSES = new Set(['killed', 'retired', 'deactivated', 'disabled']);

// Basic shape guard for the caller-supplied alias address (VPS-posted body).
const ALIAS_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Resolve a relationship's forwarding posture from its alias address. The VPS
 * uses the returned `forward` flag to deliver-or-digest; mute policy and retired
 * state are authoritative server-side, not the VPS's call. Scoped to user_id
 * when the VPS supplies it, so a malformed/forged alias can't probe other rows.
 */
async function relationshipPolicy(
  aliasEmail: string | undefined,
  userId: string | undefined
): Promise<{ mutePolicy: MutePolicy | null; retired: boolean }> {
  if (!aliasEmail || !ALIAS_EMAIL_RE.test(aliasEmail)) {
    return { mutePolicy: null, retired: false };
  }
  const supabase = getSupabaseServiceClient();
  let query = supabase
    .from('identities')
    .select('mute_policy, status, is_honeypot')
    .eq('alias_email', aliasEmail);
  if (userId) query = query.eq('user_id', userId);
  const { data } = await query.single();
  if (!data) return { mutePolicy: null, retired: false };
  return {
    mutePolicy: (data.mute_policy as MutePolicy | null) ?? null,
    retired: RETIRED_STATUSES.has(String(data.status)) || Boolean(data.is_honeypot),
  };
}

export async function POST(request: Request) {
  try {
    // Verify shared secret (called from VPS, not users)
    const authHeader = request.headers.get('authorization');
    const sharedSecret = process.env.EMAIL_WEBHOOK_SECRET;

    if (!authHeader || !sharedSecret || authHeader !== `Bearer ${sharedSecret}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { subject, from, body_preview, user_id, alias_email } = body;

    if (!subject || !from) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Rate limit AI summarization per user
    if (user_id) {
      const rl = await checkRateLimit({
        key: user_id,
        config: RATE_LIMITS.aiSummary,
        userId: user_id,
        action: 'email/summarize',
      });
      const rlResponse = rateLimitResponse(rl);
      if (rlResponse) return rlResponse;
    }

    // Truncate body to 2000 chars for cost control + security
    const safePreview = (body_preview || '').slice(0, 2000);

    const type = await classifyEmail(subject, from, safePreview);

    let summary: string | null = null;
    if (type === 'marketing') {
      summary = await summarizeEmail(subject, safePreview);
    }

    const { mutePolicy, retired } = await relationshipPolicy(alias_email, user_id);
    const forward = shouldForward({ type, mutePolicy, retired });

    return Response.json({ type, summary, forward });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
