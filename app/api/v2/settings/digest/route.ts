import { getAuthUser } from '@/lib/auth';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { digestSettingsSchema } from '@/lib/validations/v2-schemas';

/**
 * PATCH /api/v2/settings/digest (v2-022) — update a user's email-forwarding
 * preferences (mode, frequency, time, weekday).
 */
export async function PATCH(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (auth.error) {
      return Response.json({ error: auth.error }, { status: 401 });
    }

    const body = await request.json();
    const parsed = digestSettingsSchema.safeParse(body);
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
        email_forward_mode: parsed.data.email_forward_mode,
        digest_frequency: parsed.data.digest_frequency,
        digest_time: parsed.data.digest_time,
        ...(parsed.data.digest_day !== undefined ? { digest_day: parsed.data.digest_day } : {}),
      })
      .eq('user_id', auth.userId!);

    if (error) {
      return Response.json({ error: 'Failed to update digest settings' }, { status: 500 });
    }

    await logAudit({
      userId: auth.userId!,
      action: 'digest_settings_updated',
      resourceType: 'user_settings',
      metadata: {
        email_forward_mode: parsed.data.email_forward_mode,
        digest_frequency: parsed.data.digest_frequency,
      },
      request,
    });

    return Response.json({ success: true, settings: parsed.data });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
