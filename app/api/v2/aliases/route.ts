import crypto from 'crypto';
import { getAuthUser } from '@/lib/auth';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { checkRateLimit, RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit';
import { logAudit } from '@/lib/audit';
import { aliasCreateSchema } from '@/lib/validations/v2-schemas';

const FREE_ALIAS_LIMIT = 3;

export async function POST(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (auth.error) {
      return Response.json({ error: auth.error }, { status: 401 });
    }

    // Rate limit: 20/hour per user
    const rl = await checkRateLimit({
      key: auth.userId!,
      config: RATE_LIMITS.aliasCreation,
      userId: auth.userId!,
      action: 'alias_create',
    });
    const rlResponse = rateLimitResponse(rl);
    if (rlResponse) return rlResponse;

    const body = await request.json();
    const parsed = aliasCreateSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // Free tier check: count existing non-honeypot email aliases
    const { count, error: countError } = await supabase
      .from('identities')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', auth.userId!)
      .eq('is_honeypot', false)
      .eq('type', 'email')
      .neq('status', 'killed');

    if (countError) {
      return Response.json({ error: 'Failed to check alias limit' }, { status: 500 });
    }

    if ((count ?? 0) >= FREE_ALIAS_LIMIT) {
      return Response.json(
        { error: `Free tier limited to ${FREE_ALIAS_LIMIT} aliases. Upgrade to Pro for more.` },
        { status: 403 }
      );
    }

    // Generate random alias email
    const aliasEmail = crypto.randomBytes(8).toString('hex') + '@phantomdefender.com';

    const { data: identity, error } = await supabase
      .from('identities')
      .insert({
        user_id: auth.userId!,
        alias_email: aliasEmail,
        label: parsed.data.label,
        service_label: parsed.data.service_label || null,
        is_honeypot: false,
        type: 'email',
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      return Response.json({ error: 'Failed to create alias' }, { status: 500 });
    }

    await logAudit({
      userId: auth.userId!,
      action: 'alias_created',
      resourceType: 'identity',
      resourceId: identity.id,
      metadata: { label: parsed.data.label, alias_email: aliasEmail },
      request,
    });

    return Response.json({ alias: identity }, { status: 201 });
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

    const { data: aliases, error } = await supabase
      .from('identities')
      .select('*')
      .eq('user_id', auth.userId!)
      .eq('is_honeypot', false)
      .eq('type', 'email')
      .order('created_at', { ascending: false });

    if (error) {
      return Response.json({ error: 'Failed to fetch aliases' }, { status: 500 });
    }

    return Response.json({ aliases: aliases || [] });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
