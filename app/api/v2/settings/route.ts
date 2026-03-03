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
      .select('plan_tier')
      .eq('user_id', auth.userId!)
      .single();

    if (error || !data) {
      // No settings row yet — default to free
      return Response.json({ plan_tier: 'free' });
    }

    return Response.json({ plan_tier: data.plan_tier || 'free' });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
