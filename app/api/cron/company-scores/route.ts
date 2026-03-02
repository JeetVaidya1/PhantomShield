import { getSupabaseServiceClient } from '@/lib/supabase';
import { verifyCronSecret } from '@/lib/webhooks/verify';

export async function POST(request: Request) {
  try {
    // Verify cron secret
    const authorization = request.headers.get('authorization') || '';
    if (!verifyCronSecret({ authorization })) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseServiceClient();
    const MIN_SAMPLE_SIZE = 10;

    // Get all unique service labels from identities
    const { data: identities, error: idError } = await supabase
      .from('identities')
      .select('id, service_label')
      .not('service_label', 'is', null);

    if (idError || !identities) {
      return Response.json({ error: 'Failed to fetch identities' }, { status: 500 });
    }

    // Group identities by normalized service label (as domain proxy)
    const companyMap = new Map<string, string[]>();
    for (const identity of identities) {
      if (!identity.service_label) continue;
      const key = identity.service_label.toLowerCase().trim();
      if (!companyMap.has(key)) {
        companyMap.set(key, []);
      }
      companyMap.get(key)!.push(identity.id);
    }

    let computed = 0;
    let skipped = 0;

    for (const [companyDomain, identityIds] of companyMap) {
      const totalAliases = identityIds.length;

      if (totalAliases < MIN_SAMPLE_SIZE) {
        skipped++;
        continue;
      }

      // Count leak detections for these identities
      const { count: leakCount } = await supabase
        .from('leak_detections')
        .select('id', { count: 'exact', head: true })
        .in('identity_id', identityIds);

      const leakDetections = leakCount ?? 0;
      const leakRate = leakDetections / totalAliases;
      const privacyScore = Math.max(0, Math.min(100, Math.round(100 - leakRate * 100)));

      await supabase.from('company_privacy_scores').upsert(
        {
          company_domain: companyDomain,
          company_name: companyDomain,
          total_aliases: totalAliases,
          leak_detections: leakDetections,
          leak_rate: leakRate,
          privacy_score: privacyScore,
          last_computed_at: new Date().toISOString(),
        },
        { onConflict: 'company_domain' }
      );

      computed++;
    }

    return Response.json({
      computed,
      skipped,
      total_companies: companyMap.size,
    });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
