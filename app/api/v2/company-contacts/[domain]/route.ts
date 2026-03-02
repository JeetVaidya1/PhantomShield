import { getAuthUser } from '@/lib/auth';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { checkRateLimit, RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit';

export async function GET(
  request: Request,
  { params }: { params: { domain: string } }
) {
  try {
    const auth = await getAuthUser(request);
    if (auth.error) {
      return Response.json({ error: auth.error }, { status: 401 });
    }

    const rl = await checkRateLimit({
      key: auth.userId,
      config: RATE_LIMITS.api,
      userId: auth.userId,
      action: 'company_contacts_lookup',
    });
    const rlResponse = rateLimitResponse(rl);
    if (rlResponse) return rlResponse;

    // Normalize domain input
    const domain = params.domain.toLowerCase().trim();
    if (!domain || domain.length > 253 || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
      return Response.json({ error: 'Invalid domain' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();

    const { data, error } = await supabase
      .from('company_privacy_contacts')
      .select('*')
      .eq('company_domain', domain)
      .single();

    if (error || !data) {
      return Response.json({ error: 'Company not found' }, { status: 404 });
    }

    return Response.json({ contact: data });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
