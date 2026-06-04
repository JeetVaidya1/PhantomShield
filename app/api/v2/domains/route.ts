import { getAuthUser } from '@/lib/auth';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { getActiveDomains } from '@/lib/email/domains';

/** GET /api/v2/domains — list active, verified domains (auth required). */
export async function GET(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (auth.error) {
      return Response.json({ error: auth.error }, { status: 401 });
    }

    const supabase = getSupabaseServiceClient();
    const domains = await getActiveDomains(supabase);

    return Response.json({
      domains: domains.map((d) => ({ id: d.id, domain: d.domain })),
    });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
