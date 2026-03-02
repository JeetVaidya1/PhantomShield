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
      action: 'trackers/stats',
    });
    const rlResponse = rateLimitResponse(rl);
    if (rlResponse) return rlResponse;

    const supabase = getSupabaseServiceClient();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: logs, error } = await supabase
      .from('tracker_logs')
      .select('*')
      .eq('user_id', auth.userId!)
      .gte('processed_at', thirtyDaysAgo.toISOString())
      .order('processed_at', { ascending: false });

    if (error) {
      return Response.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }

    const entries = logs || [];

    // Aggregate stats
    const total_trackers_blocked = entries.reduce(
      (sum, l) => sum + (l.trackers_stripped || 0),
      0
    );
    const total_links_cleaned = entries.reduce(
      (sum, l) => sum + (l.links_cleaned || 0),
      0
    );
    const emails_processed = entries.length;

    // Top tracker companies
    const companyCounts: Record<string, number> = {};
    for (const log of entries) {
      for (const company of log.tracker_companies || []) {
        companyCounts[company] = (companyCounts[company] || 0) + 1;
      }
    }
    const top_tracker_companies = Object.entries(companyCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([company, count]) => ({ company, count }));

    // Daily trend (last 30 days)
    const dailyMap: Record<string, { trackers: number; emails: number }> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      dailyMap[key] = { trackers: 0, emails: 0 };
    }
    for (const log of entries) {
      const key = new Date(log.processed_at).toISOString().split('T')[0];
      if (dailyMap[key]) {
        dailyMap[key].trackers += log.trackers_stripped || 0;
        dailyMap[key].emails += 1;
      }
    }
    const daily_trend = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date, ...data }));

    return Response.json({
      total_trackers_blocked,
      total_links_cleaned,
      emails_processed,
      top_tracker_companies,
      daily_trend,
    });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
