import { getAuthUser } from '@/lib/auth';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthUser(request);
    if (auth.error) {
      return Response.json({ error: auth.error }, { status: 401 });
    }

    const body = await request.json();
    const { status } = body;

    const validStatuses = ['sent', 'awaiting', 'completed', 'ignored', 'escalated'];
    if (!validStatuses.includes(status)) {
      return Response.json({ error: 'Invalid status' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();

    const updateData: any = { status };
    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('deletion_requests')
      .update(updateData)
      .eq('id', params.id)
      .eq('user_id', auth.userId)
      .select()
      .single();

    if (error || !data) {
      return Response.json({ error: 'Request not found' }, { status: 404 });
    }

    await logAudit({
      userId: auth.userId,
      action: 'gdpr_request_updated',
      resourceType: 'deletion_request',
      resourceId: params.id,
      metadata: { new_status: status },
      request,
    });

    return Response.json({ request: data });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
