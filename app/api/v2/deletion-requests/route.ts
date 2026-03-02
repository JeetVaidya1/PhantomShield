import { getAuthUser } from '@/lib/auth';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { checkRateLimit, RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit';
import { logAudit } from '@/lib/audit';
import { gdprRequestSchema } from '@/lib/validations/v2-schemas';
import { getTemplate } from '@/lib/gdpr/templates';

export async function POST(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (auth.error) {
      return Response.json({ error: auth.error }, { status: 401 });
    }

    // Rate limit: 10/day per user
    const rl = await checkRateLimit({
      key: auth.userId!,
      config: RATE_LIMITS.gdprSend,
      userId: auth.userId!,
      action: 'gdpr_send',
    });
    const rlResponse = rateLimitResponse(rl);
    if (rlResponse) return rlResponse;

    const body = await request.json();
    const parsed = gdprRequestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // Get the identity (for alias email)
    const { data: identity } = await supabase
      .from('identities')
      .select('*')
      .eq('id', parsed.data.identity_id)
      .eq('user_id', auth.userId!)
      .single();

    if (!identity) {
      return Response.json({ error: 'Identity not found' }, { status: 404 });
    }

    // Generate email from template
    const emailBody = getTemplate(
      parsed.data.request_type as 'gdpr_erasure' | 'ccpa_deletion',
      identity.alias_email || identity.email || parsed.data.identity_id,
      parsed.data.company_name
    );

    const sentAt = new Date();
    const responseDeadline = new Date(sentAt);
    responseDeadline.setDate(responseDeadline.getDate() + 30);

    // Create deletion request record
    const { data: deletionRequest, error } = await supabase
      .from('deletion_requests')
      .insert({
        user_id: auth.userId!,
        identity_id: parsed.data.identity_id,
        company_name: parsed.data.company_name,
        company_email: parsed.data.company_email,
        request_type: parsed.data.request_type,
        status: 'sent',
        sent_at: sentAt.toISOString(),
        response_deadline: responseDeadline.toISOString(),
      })
      .select()
      .single();

    if (error) {
      return Response.json({ error: 'Failed to create request' }, { status: 500 });
    }

    // Save unknown company contact for crowdsourcing
    const companyDomain = parsed.data.company_email.split('@')[1];
    if (companyDomain) {
      await supabase.from('company_privacy_contacts').upsert(
        {
          company_domain: companyDomain.toLowerCase(),
          company_name: parsed.data.company_name,
          privacy_email: parsed.data.company_email,
          contributed_by_count: 1,
        },
        { onConflict: 'company_domain' }
      );
    }

    await logAudit({
      userId: auth.userId!,
      action: 'gdpr_request_sent',
      resourceType: 'deletion_request',
      resourceId: deletionRequest.id,
      metadata: {
        company: parsed.data.company_name,
        request_type: parsed.data.request_type,
      },
      request,
    });

    return Response.json(
      {
        request: deletionRequest,
        email_body: emailBody,
      },
      { status: 201 }
    );
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

    const { data, error } = await supabase
      .from('deletion_requests')
      .select('*')
      .eq('user_id', auth.userId!)
      .order('created_at', { ascending: false });

    if (error) {
      return Response.json({ error: 'Failed to fetch requests' }, { status: 500 });
    }

    return Response.json({ requests: data || [] });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
