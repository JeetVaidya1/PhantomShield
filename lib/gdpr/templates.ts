/**
 * GDPR Article 17 and CCPA Section 1798.105 email templates.
 * Only alias_email and company_name are variable — no template injection possible.
 */

export function gdprErasureTemplate(aliasEmail: string, companyName: string): string {
  return `To Whom It May Concern,

I am writing to request the erasure of my personal data pursuant to Article 17 of the General Data Protection Regulation (GDPR).

I am a user of your service, ${companyName}, and I can be identified by the following email address: ${aliasEmail}

I request that you erase all personal data you hold about me, including but not limited to:
- Account information
- Usage data and analytics
- Marketing profiles
- Any data shared with third parties

Under Article 17 of the GDPR, you are required to erase my personal data without undue delay and in any event within one month of receipt of this request.

Please confirm the completion of this request by responding to this email.

Regards,
A concerned data subject`;
}

export function ccpaDeletionTemplate(aliasEmail: string, companyName: string): string {
  return `To Whom It May Concern,

I am writing to exercise my right to deletion under the California Consumer Privacy Act (CCPA), Section 1798.105.

I am a consumer who has used your service, ${companyName}, and I can be identified by the following email address: ${aliasEmail}

I request that you delete all personal information you have collected about me. Under the CCPA, you must delete my personal information from your records and direct any service providers to delete my personal information from their records.

You are required to respond to this request within 45 days.

Please confirm the completion of this request by responding to this email.

Regards,
A California consumer`;
}

export function getTemplate(
  requestType: 'gdpr_erasure' | 'ccpa_deletion',
  aliasEmail: string,
  companyName: string
): string {
  switch (requestType) {
    case 'gdpr_erasure':
      return gdprErasureTemplate(aliasEmail, companyName);
    case 'ccpa_deletion':
      return ccpaDeletionTemplate(aliasEmail, companyName);
    default:
      return gdprErasureTemplate(aliasEmail, companyName);
  }
}
