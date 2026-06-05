import { getAuthUser } from '@/lib/auth';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { checkRateLimit, RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit';
import { logAudit } from '@/lib/audit';
import { retireSchema } from '@/lib/validations/v2-schemas';
import { retireIdentity } from '@/lib/identity/retire';

// Any status that means the relationship is no longer a live alias.
const ALREADY_RETIRED = new Set(['killed', 'retired', 'deactivated', 'disabled']);

/**
 * POST /api/v2/identities/[id]/retire
 *
 * Retire one relationship — "I'm done with this vendor". Stops forwarding,
 * fires a GDPR/CCPA erasure when the vendor's privacy contact is known, and
 * either kills the alias ('kill') or keeps it alive as a honeypot tripwire
 * ('honeypot') to catch a vendor that ignores the deletion / sold you on.
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

    // Reuse the GDPR-send budget — retiring fires an erasure request.
    const rl = await checkRateLimit({
      key: auth.userId!,
      config: RATE_LIMITS.gdprSend,
      userId: auth.userId!,
      action: 'identity_retire',
    });
    const rlResponse = rateLimitResponse(rl);
    if (rlResponse) return rlResponse;

    const body = await request.json().catch(() => ({}));
    const parsed = retireSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // Scope to the owner and require a still-active relationship.
    const { data: identity, error } = await supabase
      .from('identities')
      .select('id, alias_email, service_label, vendor_domain, type, status, simplelogin_alias_id')
      .eq('id', params.id)
      .eq('user_id', auth.userId!)
      .single();

    if (error || !identity) {
      return Response.json({ error: 'Relationship not found' }, { status: 404 });
    }
    // Block any already-retired state so a honeypot can't be re-retired into a
    // kill (which would fire a second deletion request for the same vendor).
    if (ALREADY_RETIRED.has(identity.status ?? '')) {
      return Response.json({ error: 'Relationship already retired' }, { status: 409 });
    }

    const result = await retireIdentity(supabase, {
      identity,
      userId: auth.userId!,
      mode: parsed.data.mode,
      requestType: parsed.data.request_type,
    });

    await logAudit({
      userId: auth.userId!,
      action: 'identity_retired',
      resourceType: 'identity',
      resourceId: params.id,
      metadata: {
        mode: result.mode,
        new_status: result.newStatus,
        gdpr_request_recorded: result.gdprRequestRecorded,
        vendor_domain: identity.vendor_domain ?? null,
      },
      request,
    });

    return Response.json({
      retired: true,
      mode: result.mode,
      status: result.newStatus,
      gdpr_request_recorded: result.gdprRequestRecorded,
    });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
