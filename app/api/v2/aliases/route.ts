import crypto from 'crypto';
import { getAuthUser } from '@/lib/auth';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { checkRateLimit, RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit';
import { logAudit } from '@/lib/audit';
import { aliasCreateSchema } from '@/lib/validations/v2-schemas';
import { selectDomainForNewAlias } from '@/lib/email/domains';
import { generateAliasAddress } from '@/lib/email/alias-address';
import { createAlias } from '@/lib/email/alias-sync';
import {
  encryptForwardingEmailAtRest,
  decryptForwardingEmailAtRest,
} from '@/lib/crypto/server';

/**
 * SimpleLogin + multi-domain alias provisioning is active only when the bridge
 * is configured (SIMPLELOGIN_DB_URI). Otherwise we fall back to the original
 * single-domain Cloudflare flow — see CLAUDE.md's phased email rollout. (v2-013)
 */
function simpleLoginEnabled(): boolean {
  return Boolean(process.env.SIMPLELOGIN_DB_URI);
}

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

    // Select sending domain + generate the alias address. With SimpleLogin
    // enabled, spread aliases across verified domains; otherwise fall back to
    // the single Cloudflare domain.
    let aliasEmail: string;
    let domainId: string | null = null;
    let simpleloginAliasId: number | null = null;

    if (simpleLoginEnabled()) {
      const domain = await selectDomainForNewAlias(supabase, auth.userId!);
      domainId = domain.id;
      aliasEmail = generateAliasAddress(domain.domain);
    } else {
      aliasEmail = crypto.randomBytes(8).toString('hex') + '@phantomdefender.com';
    }

    // Build service_label: "Label — Service" if service provided, else just label
    const serviceLabel = parsed.data.service_label
      ? `${parsed.data.label} — ${parsed.data.service_label}`
      : parsed.data.label;

    // Create the forwarding alias in SimpleLogin before persisting our record,
    // so a bridge failure aborts cleanly without leaving an orphan identity.
    if (simpleLoginEnabled()) {
      const sl = await createAlias(auth.userId!, aliasEmail, parsed.data.forwarding_email);
      simpleloginAliasId = sl.simpleloginAliasId;
    }

    const { data: identity, error } = await supabase
      .from('identities')
      .insert({
        user_id: auth.userId!,
        alias_email: aliasEmail,
        service_label: serviceLabel,
        // Captured vendor host (e.g. "netflix.com") — drives precise leak
        // attribution and GDPR routing when this relationship is retired.
        vendor_domain: parsed.data.vendor_domain ?? null,
        is_honeypot: false,
        type: 'email',
        status: 'active',
        domain_id: domainId,
        simplelogin_alias_id: simpleloginAliasId,
        // Encrypted at rest; SimpleLogin still receives the plaintext above.
        forwarding_email: encryptForwardingEmailAtRest(parsed.data.forwarding_email),
      })
      .select()
      .single();

    if (error) {
      return Response.json({ error: 'Failed to create alias' }, { status: 500 });
    }

    await logAudit({
      userId: auth.userId!,
      action: 'identity_created',
      resourceType: 'identity',
      resourceId: identity.id,
      metadata: {
        service_label: serviceLabel,
        alias_email: aliasEmail,
        domain_id: domainId,
        simplelogin_alias_id: simpleloginAliasId,
      },
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

    // Decrypt forwarding addresses for the owner's own view (over HTTPS, RLS-scoped).
    const decrypted = (aliases || []).map((a) => ({
      ...a,
      forwarding_email: decryptForwardingEmailAtRest(a.forwarding_email),
    }));

    return Response.json({ aliases: decrypted });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
