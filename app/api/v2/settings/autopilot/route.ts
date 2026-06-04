import { getAuthUser } from '@/lib/auth';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { autopilotSettingsSchema } from '@/lib/validations/v2-schemas';

/** PATCH /api/v2/settings/autopilot (v2-031) — toggle autopilot + mode + threshold. */
export async function PATCH(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (auth.error) {
      return Response.json({ error: auth.error }, { status: 401 });
    }

    const body = await request.json();
    const parsed = autopilotSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();
    const { error } = await supabase
      .from('user_settings')
      .update({
        autopilot_enabled: parsed.data.autopilot_enabled,
        autopilot_mode: parsed.data.autopilot_mode,
        autopilot_auto_kill_days: parsed.data.autopilot_auto_kill_days,
      })
      .eq('user_id', auth.userId!);

    if (error) {
      return Response.json({ error: 'Failed to update autopilot settings' }, { status: 500 });
    }

    await logAudit({
      userId: auth.userId!,
      action: 'autopilot_settings_updated',
      resourceType: 'user_settings',
      metadata: { ...parsed.data },
      request,
    });

    return Response.json({ success: true, settings: parsed.data });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
