import { getAuthUser } from '@/lib/auth';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { checkRateLimit, RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit';
import { logAudit } from '@/lib/audit';
import { z } from 'zod';

const killSchema = z.object({
  identity_ids: z.array(z.string().uuid()).min(1).max(100),
});

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
      action: 'autopilot_kill',
    });
    const rlResponse = rateLimitResponse(rl);
    if (rlResponse) return rlResponse;

    const body = await request.json();
    const parsed = killSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // Get the latest scan to verify these IDs came from it
    const { data: latestScan } = await supabase
      .from('autopilot_scans')
      .select('*')
      .eq('user_id', auth.userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!latestScan) {
      return Response.json({ error: 'No scan found. Run a scan first.' }, { status: 400 });
    }

    const scanIdentityIds = (latestScan.stale_identities as Array<{ identity_id: string }>).map(
      (s) => s.identity_id
    );

    // Verify all requested IDs are from the latest scan
    const invalidIds = parsed.data.identity_ids.filter((id) => !scanIdentityIds.includes(id));
    if (invalidIds.length > 0) {
      return Response.json(
        { error: 'Some identity IDs are not from the latest scan', invalid_ids: invalidIds },
        { status: 400 }
      );
    }

    // Deactivate each identity (verify user ownership via RLS)
    let killedCount = 0;
    for (const identityId of parsed.data.identity_ids) {
      const { error } = await supabase
        .from('identities')
        .update({ status: 'deactivated' })
        .eq('id', identityId)
        .eq('user_id', auth.userId);

      if (!error) {
        killedCount++;
      }
    }

    await logAudit({
      userId: auth.userId,
      action: 'autopilot_kill',
      resourceType: 'identities',
      metadata: {
        identity_ids: parsed.data.identity_ids,
        killed_count: killedCount,
        scan_id: latestScan.id,
      },
      request,
    });

    return Response.json({
      killed_count: killedCount,
      requested_count: parsed.data.identity_ids.length,
    });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
