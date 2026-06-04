import { z } from 'zod';
import { getAuthUser } from '@/lib/auth';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { checkRateLimit, RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit';
import { logAudit } from '@/lib/audit';
import { BLOCKED_THRESHOLD } from '@/lib/email/domains';

const paramsSchema = z.object({ id: z.string().uuid('Invalid domain id') });

/**
 * POST /api/v2/domains/:id/report-blocked
 * Increments a domain's blocked_count; auto-deactivates at the threshold.
 * Rate limited to 10/hour per user to prevent abuse.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthUser(request);
    if (auth.error) {
      return Response.json({ error: auth.error }, { status: 401 });
    }

    const parsed = paramsSchema.safeParse(params);
    if (!parsed.success) {
      return Response.json({ error: 'Invalid domain id' }, { status: 400 });
    }

    const rl = await checkRateLimit({
      key: auth.userId!,
      config: RATE_LIMITS.domainReportBlocked,
      userId: auth.userId!,
      action: 'domain_report_blocked',
    });
    const rlResponse = rateLimitResponse(rl);
    if (rlResponse) return rlResponse;

    const supabase = getSupabaseServiceClient();

    const { data: domain, error: fetchError } = await supabase
      .from('alias_domains')
      .select('id, blocked_count, active')
      .eq('id', parsed.data.id)
      .single();

    if (fetchError || !domain) {
      return Response.json({ error: 'Domain not found' }, { status: 404 });
    }

    const newCount = (domain.blocked_count ?? 0) + 1;
    const shouldDeactivate = newCount >= BLOCKED_THRESHOLD;

    const { error: updateError } = await supabase
      .from('alias_domains')
      .update({
        blocked_count: newCount,
        ...(shouldDeactivate ? { active: false } : {}),
      })
      .eq('id', parsed.data.id);

    if (updateError) {
      return Response.json({ error: 'Failed to report domain' }, { status: 500 });
    }

    if (shouldDeactivate) {
      await logAudit({
        userId: auth.userId!,
        action: 'domain_auto_deactivated',
        resourceType: 'alias_domain',
        resourceId: parsed.data.id,
        metadata: { blocked_count: newCount },
        request,
      });
    }

    return Response.json({
      blocked_count: newCount,
      deactivated: shouldDeactivate,
    });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
