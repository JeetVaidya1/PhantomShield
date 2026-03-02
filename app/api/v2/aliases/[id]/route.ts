import { getAuthUser } from '@/lib/auth';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';

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

    const { data: identity, error } = await supabase
      .from('identities')
      .update({ status: 'killed' })
      .eq('id', params.id)
      .eq('user_id', auth.userId!)
      .select()
      .single();

    if (error || !identity) {
      return Response.json({ error: 'Alias not found or already deleted' }, { status: 404 });
    }

    await logAudit({
      userId: auth.userId!,
      action: 'alias_deleted',
      resourceType: 'identity',
      resourceId: params.id,
      metadata: { label: identity.label, alias_email: identity.alias_email },
      request,
    });

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
