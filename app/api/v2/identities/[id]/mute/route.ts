import { getAuthUser } from '@/lib/auth';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { checkRateLimit, RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit';
import { logAudit } from '@/lib/audit';
import { muteUpdateSchema } from '@/lib/validations/v2-schemas';

/**
 * PATCH /api/v2/identities/[id]/mute
 *
 * Set a relationship's inbox policy:
 *   'transactional_only' (default) — only OTPs/receipts/shipping reach you
 *   'all'                          — forward everything
 *   'silent'                       — forward nothing
 * Signing up for things becomes costless: the marketing never reaches you.
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthUser(request);
    if (auth.error) {
      return Response.json({ error: auth.error }, { status: 401 });
    }

    const rl = await checkRateLimit({
      key: auth.userId!,
      config: RATE_LIMITS.api,
      userId: auth.userId!,
      action: 'identity_mute',
    });
    const rlResponse = rateLimitResponse(rl);
    if (rlResponse) return rlResponse;

    const body = await request.json().catch(() => ({}));
    const parsed = muteUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    const { data: identity, error } = await supabase
      .from('identities')
      .update({ mute_policy: parsed.data.mute_policy })
      .eq('id', params.id)
      .eq('user_id', auth.userId!)
      .select('id, mute_policy')
      .single();

    if (error || !identity) {
      return Response.json({ error: 'Relationship not found' }, { status: 404 });
    }

    await logAudit({
      userId: auth.userId!,
      action: 'identity_mute_updated',
      resourceType: 'identity',
      resourceId: params.id,
      metadata: { mute_policy: parsed.data.mute_policy },
      request,
    });

    return Response.json({ id: identity.id, mute_policy: identity.mute_policy });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
