import { getAuthUser } from '@/lib/auth';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { checkRateLimit, RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit';
import { logAudit } from '@/lib/audit';
import { honeypotCreateSchema } from '@/lib/validations/v2-schemas';

export async function POST(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (auth.error) {
      return Response.json({ error: auth.error }, { status: 401 });
    }

    // Rate limit: 5/day per user
    const rl = await checkRateLimit({
      key: auth.userId,
      config: RATE_LIMITS.honeypotCreation,
      userId: auth.userId,
      action: 'honeypot_create',
    });
    const rlResponse = rateLimitResponse(rl);
    if (rlResponse) return rlResponse;

    const body = await request.json();
    const parsed = honeypotCreateSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // Create identity with is_honeypot=true
    const { data: identity, error } = await supabase
      .from('identities')
      .insert({
        user_id: auth.userId,
        is_honeypot: true,
        service_label: parsed.data.planted_at_service,
        label: parsed.data.label,
      })
      .select()
      .single();

    if (error) {
      return Response.json({ error: 'Failed to create honeypot' }, { status: 500 });
    }

    await logAudit({
      userId: auth.userId,
      action: 'honeypot_created',
      resourceType: 'identity',
      resourceId: identity.id,
      metadata: { label: parsed.data.label, service: parsed.data.planted_at_service },
      request,
    });

    return Response.json({ honeypot: identity }, { status: 201 });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (auth.error) {
      return Response.json({ error: auth.error }, { status: 401 });
    }

    const supabase = getSupabaseServiceClient();

    // Get honeypots with trigger counts
    const { data: honeypots, error } = await supabase
      .from('identities')
      .select('*')
      .eq('user_id', auth.userId)
      .eq('is_honeypot', true)
      .order('created_at', { ascending: false });

    if (error) {
      return Response.json({ error: 'Failed to fetch honeypots' }, { status: 500 });
    }

    // Get trigger counts for each honeypot
    const honeypotsWithTriggers = await Promise.all(
      (honeypots || []).map(async (hp) => {
        const { data: triggers } = await supabase
          .from('honeypot_triggers')
          .select('*')
          .eq('identity_id', hp.id)
          .order('triggered_at', { ascending: false });

        const triggerList = triggers || [];
        return {
          ...hp,
          trigger_count: triggerList.length,
          last_trigger: triggerList[0]?.triggered_at || null,
          triggers: triggerList,
        };
      })
    );

    return Response.json({ honeypots: honeypotsWithTriggers });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
