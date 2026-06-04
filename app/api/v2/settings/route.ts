import { getAuthUser } from '@/lib/auth';
import { getSupabaseServiceClient } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (auth.error) {
      return Response.json({ error: auth.error }, { status: 401 });
    }

    const supabase = getSupabaseServiceClient();

    const { data, error } = await supabase
      .from('user_settings')
      .select('plan_tier, autopilot_enabled, autopilot_mode, autopilot_auto_kill_days')
      .eq('user_id', auth.userId!)
      .single();

    if (error || !data) {
      // No settings row yet — return defaults.
      return Response.json({
        plan_tier: 'free',
        autopilot_enabled: false,
        autopilot_mode: 'manual',
        autopilot_auto_kill_days: 90,
      });
    }

    return Response.json({
      plan_tier: data.plan_tier || 'free',
      autopilot_enabled: data.autopilot_enabled ?? false,
      autopilot_mode: data.autopilot_mode ?? 'manual',
      autopilot_auto_kill_days: data.autopilot_auto_kill_days ?? 90,
    });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
