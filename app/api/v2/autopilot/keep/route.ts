import { getAuthUser } from '@/lib/auth';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { autopilotKeepSchema } from '@/lib/validations/v2-schemas';

/**
 * POST /api/v2/autopilot/keep (v2-031) — mark identities as reviewed/kept so
 * they are excluded from future stale scans.
 */
export async function POST(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (auth.error) {
      return Response.json({ error: auth.error }, { status: 401 });
    }

    const body = await request.json();
    const parsed = autopilotKeepSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();
    const { error } = await supabase
      .from('identities')
      .update({ autopilot_reviewed_at: new Date().toISOString() })
      .in('id', parsed.data.identity_ids)
      .eq('user_id', auth.userId!);

    if (error) {
      return Response.json({ error: 'Failed to update identities' }, { status: 500 });
    }

    await logAudit({
      userId: auth.userId!,
      action: 'autopilot_kept',
      resourceType: 'identities',
      metadata: { identity_ids: parsed.data.identity_ids },
      request,
    });

    return Response.json({ success: true, kept_count: parsed.data.identity_ids.length });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
