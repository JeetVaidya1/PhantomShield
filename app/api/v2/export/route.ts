import { getAuthUser } from '@/lib/auth';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { checkRateLimit, RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit';
import { logAudit } from '@/lib/audit';

export async function GET(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (auth.error) {
      return Response.json({ error: auth.error }, { status: 401 });
    }

    const biometricToken = request.headers.get('x-biometric-token');
    if (!biometricToken) {
      return Response.json({ error: 'Biometric token required' }, { status: 403 });
    }

    const rl = await checkRateLimit({
      key: auth.userId!,
      config: RATE_LIMITS.api,
      userId: auth.userId!,
      action: 'data_export',
    });
    const rlResponse = rateLimitResponse(rl);
    if (rlResponse) return rlResponse;

    const url = new URL(request.url);
    const format = url.searchParams.get('format') || 'json';

    const supabase = getSupabaseServiceClient();

    // Fetch all user data
    const [identitiesRes, trackersRes, leaksRes, gdprRes] = await Promise.all([
      supabase.from('identities').select('id, alias_email, service_label, domain, type, status, is_honeypot, created_at').eq('user_id', auth.userId!),
      supabase.from('tracker_stats').select('*').eq('user_id', auth.userId!),
      supabase.from('leak_detections').select('*').eq('user_id', auth.userId!),
      supabase.from('deletion_requests').select('*').eq('user_id', auth.userId!),
    ]);

    const identities = identitiesRes.data || [];
    const trackerStats = trackersRes.data || [];
    const leakDetections = leaksRes.data || [];
    const deletionRequests = gdprRes.data || [];

    // SimpleLogin-compatible alias format
    const simpleloginAliases = identities
      .filter((i) => i.type !== 'phone' && i.alias_email)
      .map((i) => ({
        alias: i.alias_email,
        enabled: i.status === 'active',
        note: i.service_label || '',
      }));

    const exportData = {
      exported_at: new Date().toISOString(),
      user_id: auth.userId!,
      identities: identities.map((i) => ({
        alias_email: i.alias_email,
        service_label: i.service_label,
        domain: i.domain,
        type: i.type,
        status: i.status,
        is_honeypot: i.is_honeypot,
        created_at: i.created_at,
      })),
      tracker_stats: trackerStats,
      leak_detections: leakDetections.map((l) => ({
        expected_sender: l.expected_sender,
        actual_sender_domain: l.actual_sender_domain,
        detected_at: l.detected_at,
        dismissed: l.dismissed,
      })),
      deletion_requests: deletionRequests.map((r) => ({
        company_name: r.company_name,
        company_email: r.company_email,
        request_type: r.request_type,
        status: r.status,
        sent_at: r.sent_at,
        completed_at: r.completed_at,
      })),
      simplelogin_compatible: { aliases: simpleloginAliases },
    };

    await logAudit({
      userId: auth.userId!,
      action: 'data_exported',
      resourceType: 'export',
      metadata: { format, identity_count: identities.length },
      request,
    });

    if (format === 'csv') {
      const csvRows = ['alias_email,service_label,domain,type,status,is_honeypot,created_at'];
      for (const i of identities) {
        csvRows.push(
          [i.alias_email || '', i.service_label || '', i.domain || '', i.type || '', i.status || '', String(i.is_honeypot || false), i.created_at || '']
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(',')
        );
      }
      return new Response(csvRows.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="phantom-defender-export.csv"',
        },
      });
    }

    return Response.json(exportData, {
      headers: {
        'Content-Disposition': 'attachment; filename="phantom-defender-export.json"',
      },
    });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
