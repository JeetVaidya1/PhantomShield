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
      .from('autopilot_scans')
      .select('*')
      .eq('user_id', auth.userId!)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return Response.json({ error: 'No scan results found' }, { status: 404 });
    }

    return Response.json({ scan: data });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
