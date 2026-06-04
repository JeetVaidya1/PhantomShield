import { getAuthUser } from '@/lib/auth';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';

/**
 * DELETE /api/v2/email/:id (v2-023) — remove an email_summary record.
 * Scoped to the caller via user_id (RLS); never deletes another user's mail.
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
    const { error } = await supabase
      .from('email_summaries')
      .delete()
      .eq('id', params.id)
      .eq('user_id', auth.userId!);

    if (error) {
      return Response.json({ error: 'Failed to delete email' }, { status: 500 });
    }

    await logAudit({
      userId: auth.userId!,
      action: 'email_deleted',
      resourceType: 'email_summary',
      resourceId: params.id,
      request,
    });

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
