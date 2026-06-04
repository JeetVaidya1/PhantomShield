import { getAuthUser } from '@/lib/auth';
import { getSupabaseServiceClient } from '@/lib/supabase';

/**
 * GET /api/v2/family/stats (v2-038) — aggregate privacy stats across the
 * family. Returns ONLY totals; never exposes any individual member's aliases,
 * emails, or identity details. Each member's vault stays private.
 */
export async function GET(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (auth.error) {
      return Response.json({ error: auth.error }, { status: 401 });
    }

    const supabase = getSupabaseServiceClient();

    // Which family does the caller belong to?
    const { data: membership } = await supabase
      .from('family_members')
      .select('family_id')
      .eq('user_id', auth.userId!)
      .eq('status', 'active')
      .maybeSingle();

    if (!membership) {
      return Response.json({ error: 'Not in a family' }, { status: 404 });
    }

    // All active member user_ids in this family.
    const { data: members } = await supabase
      .from('family_members')
      .select('user_id')
      .eq('family_id', membership.family_id)
      .eq('status', 'active');

    const userIds = (members ?? [])
      .map((m: { user_id: string | null }) => m.user_id)
      .filter((id): id is string => Boolean(id));

    if (userIds.length === 0) {
      return Response.json({ stats: { total_trackers_blocked: 0, total_aliases: 0, total_leaks: 0, member_count: 0 } });
    }

    // Aggregate counts only — no row-level data leaves the server.
    const [trackerRows, aliasCount, leakCount] = await Promise.all([
      supabase.from('tracker_logs').select('trackers_stripped').in('user_id', userIds),
      supabase.from('identities').select('id', { count: 'exact', head: true }).in('user_id', userIds),
      supabase.from('leak_detections').select('id', { count: 'exact', head: true }).in('user_id', userIds),
    ]);

    const totalTrackers = (trackerRows.data ?? []).reduce(
      (sum: number, r: { trackers_stripped: number | null }) => sum + (r.trackers_stripped ?? 0),
      0
    );

    return Response.json({
      stats: {
        total_trackers_blocked: totalTrackers,
        total_aliases: aliasCount.count ?? 0,
        total_leaks: leakCount.count ?? 0,
        member_count: userIds.length,
      },
    });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
