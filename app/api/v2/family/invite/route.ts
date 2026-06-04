import crypto from 'crypto';
import { getAuthUser } from '@/lib/auth';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { checkRateLimit, RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit';
import { logAudit } from '@/lib/audit';
import { familyInviteSchema } from '@/lib/validations/v2-schemas';

/** Hash an invitee email for the audit trail so a third party's PII isn't stored verbatim. */
function hashEmail(email: string): string {
  return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 16);
}

/**
 * POST /api/v2/family/invite (v2-038) — owner invites a member by email.
 * Creates a pending family_members record. Rate limited to 10/day per user.
 */
export async function POST(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (auth.error) {
      return Response.json({ error: auth.error }, { status: 401 });
    }

    const rl = await checkRateLimit({
      key: auth.userId!,
      config: RATE_LIMITS.familyInvite,
      userId: auth.userId!,
      action: 'family_invite',
    });
    const rlResponse = rateLimitResponse(rl);
    if (rlResponse) return rlResponse;

    const body = await request.json();
    const parsed = familyInviteSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // Only the family owner can invite.
    const { data: family } = await supabase
      .from('families')
      .select('id, max_members')
      .eq('owner_id', auth.userId!)
      .maybeSingle();

    if (!family) {
      return Response.json({ error: 'You do not own a family' }, { status: 403 });
    }

    // Enforce the member cap (active + pending).
    const { count } = await supabase
      .from('family_members')
      .select('id', { count: 'exact', head: true })
      .eq('family_id', family.id);

    if ((count ?? 0) >= (family.max_members ?? 5)) {
      return Response.json({ error: 'Family is full' }, { status: 403 });
    }

    const { error } = await supabase.from('family_members').insert({
      family_id: family.id,
      invite_email: parsed.data.email,
      role: 'member',
      status: 'pending',
    });

    if (error) {
      return Response.json({ error: 'Failed to send invite' }, { status: 500 });
    }

    await logAudit({
      userId: auth.userId!,
      action: 'family_invite_sent',
      resourceType: 'family',
      resourceId: family.id,
      metadata: { invite_email_hash: hashEmail(parsed.data.email) },
      request,
    });

    return Response.json({ success: true }, { status: 201 });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
