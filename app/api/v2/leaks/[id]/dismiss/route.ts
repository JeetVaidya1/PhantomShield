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

    const supabase = getSupabaseServiceClient();

    // Verify ownership and update
    const { data, error } = await supabase
      .from('leak_detections')
      .update({ dismissed: true })
      .eq('id', params.id)
      .eq('user_id', auth.userId)
      .select()
      .single();

    if (error || !data) {
      return Response.json({ error: 'Leak detection not found' }, { status: 404 });
    }

    await logAudit({
      userId: auth.userId,
      action: 'leak_dismissed',
      resourceType: 'leak_detection',
      resourceId: params.id,
      request,
    });

    return Response.json({ success: true, leak: data });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
