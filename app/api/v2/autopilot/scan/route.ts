import { getAuthUser } from '@/lib/auth';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { checkRateLimit, RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit';
import { logAudit } from '@/lib/audit';

export async function POST(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (auth.error) {
      return Response.json({ error: auth.error }, { status: 401 });
    }

    const rl = await checkRateLimit({
      key: auth.userId,
      config: RATE_LIMITS.api,
      userId: auth.userId,
      action: 'autopilot_scan',
    });
    const rlResponse = rateLimitResponse(rl);
    if (rlResponse) return rlResponse;

    const supabase = getSupabaseServiceClient();

    // Get all active identities for this user
    const { data: identities, error: idError } = await supabase
      .from('identities')
      .select('id, alias_email, service_label, type, is_honeypot, status, created_at')
      .eq('user_id', auth.userId)
      .eq('status', 'active');

    if (idError) {
      return Response.json({ error: 'Failed to fetch identities' }, { status: 500 });
    }

    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const staleIdentities: Array<{ identity_id: string; reason: string }> = [];

    for (const identity of identities || []) {
      if (identity.is_honeypot) continue; // Skip honeypots

      if (identity.type === 'phone') {
        // Check for unused phone numbers (no SMS in 60 days)
        const { count } = await supabase
          .from('sms_messages')
          .select('id', { count: 'exact', head: true })
          .eq('identity_id', identity.id)
          .gte('received_at', sixtyDaysAgo.toISOString());

        if ((count ?? 0) === 0) {
          staleIdentities.push({
            identity_id: identity.id,
            reason: 'No SMS received in 60 days',
          });
        }
      } else {
        // Email alias — check for no emails in 90 days
        const { count: emailCount } = await supabase
          .from('email_summaries')
          .select('id', { count: 'exact', head: true })
          .eq('identity_id', identity.id)
          .gte('created_at', ninetyDaysAgo.toISOString());

        if ((emailCount ?? 0) === 0) {
          staleIdentities.push({
            identity_id: identity.id,
            reason: 'No emails received in 90 days',
          });
        }
      }
    }

    // Store scan results
    const { data: scan, error: scanError } = await supabase
      .from('autopilot_scans')
      .insert({
        user_id: auth.userId,
        stale_count: staleIdentities.length,
        total_scanned: (identities || []).filter((i) => !i.is_honeypot).length,
        stale_identities: staleIdentities,
      })
      .select()
      .single();

    if (scanError) {
      return Response.json({ error: 'Failed to save scan results' }, { status: 500 });
    }

    await logAudit({
      userId: auth.userId,
      action: 'autopilot_scan',
      resourceType: 'autopilot_scan',
      resourceId: scan.id,
      metadata: {
        stale_count: staleIdentities.length,
        total_scanned: (identities || []).filter((i) => !i.is_honeypot).length,
      },
      request,
    });

    return Response.json({
      scan_id: scan.id,
      stale_count: staleIdentities.length,
      total_scanned: (identities || []).filter((i) => !i.is_honeypot).length,
      stale_identities: staleIdentities,
    });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
