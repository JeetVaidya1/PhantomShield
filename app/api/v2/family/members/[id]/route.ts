import { getAuthUser } from '@/lib/auth';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';

/**
 * DELETE /api/v2/family/members/:id (v2-038) — owner removes a member.
 * Only the family owner may remove members, and never themselves (they must
 * delete the whole family instead).
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthUser(request);
    if (auth.error) {
      return Response.json({ error: auth.error }, { status: 401 });
    }

    const supabase = getSupabaseServiceClient();

    // The member row being removed.
    const { data: member } = await supabase
      .from('family_members')
      .select('id, family_id, user_id, role')
      .eq('id', params.id)
      .maybeSingle();

    if (!member) {
      return Response.json({ error: 'Member not found' }, { status: 404 });
    }

    // Caller must own this member's family.
    const { data: family } = await supabase
      .from('families')
      .select('id, owner_id')
      .eq('id', member.family_id)
      .maybeSingle();

    if (!family || family.owner_id !== auth.userId!) {
      return Response.json({ error: 'Only the family owner can remove members' }, { status: 403 });
    }

    // Owner cannot remove themselves.
    if (member.user_id === auth.userId! || member.role === 'owner') {
      return Response.json(
        { error: 'Owner cannot be removed. Delete the family instead.' },
        { status: 400 }
      );
    }

    const { error } = await supabase.from('family_members').delete().eq('id', params.id);
    if (error) {
      return Response.json({ error: 'Failed to remove member' }, { status: 500 });
    }

    await logAudit({
      userId: auth.userId!,
      action: 'family_member_removed',
      resourceType: 'family',
      resourceId: member.family_id,
      metadata: { removed_member_id: params.id },
      request,
    });

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
