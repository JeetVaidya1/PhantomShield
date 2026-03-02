import { getSupabaseServiceClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';

export interface HoneypotCheckResult {
  isHoneypot: boolean;
  shouldForward: boolean;
}

/**
 * Check if an identity is a honeypot. If so, record the trigger
 * and return shouldForward=false.
 */
export async function handleHoneypotEmail(params: {
  identityId: string;
  userId: string;
  isHoneypot: boolean;
  senderEmail: string;
  senderDomain: string;
  subject: string;
}): Promise<HoneypotCheckResult> {
  if (!params.isHoneypot) {
    return { isHoneypot: false, shouldForward: true };
  }

  const supabase = getSupabaseServiceClient();

  // Record trigger
  await supabase.from('honeypot_triggers').insert({
    identity_id: params.identityId,
    user_id: params.userId,
    trigger_from_email: params.senderEmail,
    trigger_from_domain: params.senderDomain,
    trigger_subject: params.subject,
  });

  // Audit log
  await logAudit({
    userId: params.userId,
    action: 'honeypot_triggered',
    resourceType: 'identity',
    resourceId: params.identityId,
    metadata: {
      sender_email: params.senderEmail,
      sender_domain: params.senderDomain,
    },
  });

  // In production: send push notification here
  // pushNotification(params.userId, {
  //   title: '🚨 HONEYPOT TRIGGERED',
  //   body: `Your alias planted at ${service} received email from ${params.senderDomain}`,
  //   priority: 'high',
  // });

  return { isHoneypot: true, shouldForward: false };
}
