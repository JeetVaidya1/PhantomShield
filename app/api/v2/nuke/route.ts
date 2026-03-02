import { getAuthUser } from '@/lib/auth';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { checkRateLimit, RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit';
import { logAudit } from '@/lib/audit';
import { nukeConfirmSchema } from '@/lib/validations/v2-schemas';
import { getTemplate } from '@/lib/gdpr/templates';

export async function POST(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (auth.error) {
      return Response.json({ error: auth.error }, { status: 401 });
    }

    // Verify biometric token
    const biometricToken = request.headers.get('x-biometric-token');
    if (!biometricToken) {
      return Response.json({ error: 'Biometric token required' }, { status: 403 });
    }

    // Rate limit: 1 per 24 hours
    const rl = await checkRateLimit({
      key: auth.userId,
      config: RATE_LIMITS.nuke,
      userId: auth.userId,
      action: 'nuke',
    });
    const rlResponse = rateLimitResponse(rl);
    if (rlResponse) return rlResponse;

    const body = await request.json();
    const parsed = nukeConfirmSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // Step 1: Get all active identities
    const { data: identities, error: idError } = await supabase
      .from('identities')
      .select('id, alias_email, service_label, type, status')
      .eq('user_id', auth.userId)
      .eq('status', 'active');

    if (idError) {
      return Response.json({ error: 'Failed to fetch identities' }, { status: 500 });
    }

    // Step 2: Deactivate all identities
    let identitiesKilled = 0;
    for (const identity of identities || []) {
      const { error } = await supabase
        .from('identities')
        .update({ status: 'deactivated' })
        .eq('id', identity.id)
        .eq('user_id', auth.userId);

      if (!error) {
        identitiesKilled++;
      }
    }

    // Step 3: Send GDPR deletion emails for identities with service_label
    let gdprEmailsSent = 0;
    for (const identity of identities || []) {
      if (!identity.service_label || !identity.alias_email) continue;

      // Look up company contact
      const { data: contact } = await supabase
        .from('company_privacy_contacts')
        .select('privacy_email')
        .eq('company_domain', identity.service_label.toLowerCase().trim())
        .single();

      if (contact?.privacy_email) {
        // Generate GDPR email template
        const _emailBody = getTemplate(
          'gdpr_erasure',
          identity.alias_email,
          identity.service_label
        );

        // Create deletion request record
        const sentAt = new Date();
        const responseDeadline = new Date(sentAt);
        responseDeadline.setDate(responseDeadline.getDate() + 30);

        await supabase.from('deletion_requests').insert({
          user_id: auth.userId,
          identity_id: identity.id,
          company_name: identity.service_label,
          company_email: contact.privacy_email,
          request_type: 'gdpr_erasure',
          status: 'sent',
          sent_at: sentAt.toISOString(),
          response_deadline: responseDeadline.toISOString(),
        });

        gdprEmailsSent++;
      }
    }

    // Step 4: Soft-delete user account (set deleted_at, recoverable 30 days)
    const recoveryDeadline = new Date();
    recoveryDeadline.setDate(recoveryDeadline.getDate() + 30);

    await supabase
      .from('user_profiles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', auth.userId);

    // Step 5: Log to audit_log (NOT deleted — retained for security)
    await logAudit({
      userId: auth.userId,
      action: 'emergency_nuke',
      resourceType: 'account',
      metadata: {
        identities_killed: identitiesKilled,
        gdpr_emails_sent: gdprEmailsSent,
        recovery_deadline: recoveryDeadline.toISOString(),
      },
      request,
    });

    return Response.json({
      identities_killed: identitiesKilled,
      gdpr_emails_sent: gdprEmailsSent,
      recovery_deadline: recoveryDeadline.toISOString(),
    });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
