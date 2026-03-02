import { getSupabaseServiceClient } from '@/lib/supabase';
import { rateLimit, RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit';

export async function GET(
  request: Request,
  { params }: { params: { domain: string } }
) {
  try {
    // Public endpoint — rate limit by IP, no auth required
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    const rl = rateLimit(ip, RATE_LIMITS.companyScorePublic);
    const rlResponse = rateLimitResponse(rl);
    if (rlResponse) return rlResponse;

    const domain = params.domain.toLowerCase().trim();
    if (!domain || domain.length > 253) {
      return Response.json({ error: 'Invalid domain' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();

    const { data, error } = await supabase
      .from('company_privacy_scores')
      .select('company_domain, company_name, privacy_score, leak_rate, total_aliases, leak_detections, last_computed_at')
      .eq('company_domain', domain)
      .single();

    if (error || !data) {
      return Response.json(
        { error: 'insufficient_data', message: 'No score available for this company' },
        { status: 404 }
      );
    }

    if (data.total_aliases < 10) {
      return Response.json({
        company_domain: data.company_domain,
        status: 'insufficient_data',
        message: 'Not enough data to compute a reliable score',
      });
    }

    return Response.json(
      {
        company_domain: data.company_domain,
        company_name: data.company_name,
        privacy_score: data.privacy_score,
        leak_rate: data.leak_rate,
        total_aliases: data.total_aliases,
        last_computed_at: data.last_computed_at,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=86400',
        },
      }
    );
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
