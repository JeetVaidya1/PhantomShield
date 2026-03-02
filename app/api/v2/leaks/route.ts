import { getAuthUser } from '@/lib/auth';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { checkRateLimit, RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit';

export async function GET(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (auth.error) {
      return Response.json({ error: auth.error }, { status: 401 });
    }

    const rl = await checkRateLimit({
      key: auth.userId!,
      config: RATE_LIMITS.api,
      userId: auth.userId!,
      action: 'leaks',
    });
    const rlResponse = rateLimitResponse(rl);
    if (rlResponse) return rlResponse;

    const supabase = getSupabaseServiceClient();

    const { data, error } = await supabase
      .from('leak_detections')
      .select('*')
      .eq('user_id', auth.userId!)
      .eq('dismissed', false)
      .order('detected_at', { ascending: false });

    if (error) {
      return Response.json({ error: 'Failed to fetch leaks' }, { status: 500 });
    }

    return Response.json({ leaks: data || [] });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
