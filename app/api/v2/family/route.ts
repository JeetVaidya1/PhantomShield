import { getAuthUser } from '@/lib/auth';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';

const MAX_MEMBERS = 5;

/**
 * POST /api/v2/family (v2-038) — create a family with the caller as owner.
 * A user may own at most one family.
 */
export async function POST(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (auth.error) {
      return Response.json({ error: auth.error }, { status: 401 });
    }

    const supabase = getSupabaseServiceClient();

    // One family per owner.
    const { data: existing } = await supabase
      .from('families')
      .select('id')
      .eq('owner_id', auth.userId!)
      .maybeSingle();

    if (existing) {
      return Response.json({ error: 'You already own a family' }, { status: 409 });
    }

    const { data: family, error } = await supabase
      .from('families')
      .insert({ owner_id: auth.userId!, max_members: MAX_MEMBERS })
      .select()
      .single();

    if (error || !family) {
      return Response.json({ error: 'Failed to create family' }, { status: 500 });
    }

    // Owner is also a member.
    await supabase.from('family_members').insert({
      family_id: family.id,
      user_id: auth.userId!,
      role: 'owner',
      status: 'active',
    });

    await logAudit({
      userId: auth.userId!,
      action: 'family_created',
      resourceType: 'family',
      resourceId: family.id,
      request,
    });

    return Response.json({ family: { id: family.id, max_members: family.max_members } }, { status: 201 });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
