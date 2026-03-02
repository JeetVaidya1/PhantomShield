// Infrastructure sender domains that should NOT trigger leak detection
const INFRASTRUCTURE_DOMAINS = new Set([
  'sendgrid.net',
  'mailgun.org',
  'amazonaws.com',
  'amazonses.com',
  'mailchimp.com',
  'mandrillapp.com',
  'postmarkapp.com',
  'sparkpostmail.com',
  'mailjet.com',
  'constantcontact.com',
  'sailthru.com',
  'sendpulse.com',
  'sendinblue.com',
  'brevo.com',
  'intercom-mail.com',
  'hubspot.com',
  'customerio.com',
  'google.com',
  'googlemail.com',
  'outlook.com',
]);

/**
 * Fuzzy match a service label against a sender domain.
 * "Netflix" should match netflix.com, email.netflix.com, etc.
 */
export function matchesSenderDomain(
  serviceLabel: string,
  senderDomain: string
): boolean {
  const normalizedLabel = serviceLabel.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedDomain = senderDomain.toLowerCase();

  // Extract the root domain parts
  const domainParts = normalizedDomain.split('.');

  // Check if the label appears in any part of the domain
  for (const part of domainParts) {
    if (part === normalizedLabel) return true;
    if (part.includes(normalizedLabel)) return true;
  }

  // Check root domain (e.g., email.netflix.com → netflix)
  if (domainParts.length >= 2) {
    const rootDomain = domainParts[domainParts.length - 2];
    if (rootDomain === normalizedLabel) return true;
    if (rootDomain.includes(normalizedLabel)) return true;
  }

  return false;
}

/**
 * Check if a sender domain is an infrastructure/relay domain.
 */
export function isInfrastructureDomain(senderDomain: string): boolean {
  const normalized = senderDomain.toLowerCase();
  for (const infra of INFRASTRUCTURE_DOMAINS) {
    if (normalized === infra || normalized.endsWith(`.${infra}`)) {
      return true;
    }
  }
  return false;
}

export interface LeakCheckParams {
  serviceLabel: string;
  senderDomain: string;
  senderEmail: string;
}

export interface LeakCheckResult {
  isLeak: boolean;
  reason?: string;
}

/**
 * Determine if an email to a labeled alias represents a potential data leak.
 */
export function checkForLeak(params: LeakCheckParams): LeakCheckResult {
  const { serviceLabel, senderDomain, senderEmail } = params;

  // No label = can't check
  if (!serviceLabel) {
    return { isLeak: false };
  }

  // Infrastructure domains get a pass
  if (isInfrastructureDomain(senderDomain)) {
    return { isLeak: false };
  }

  // Check if sender matches the labeled service
  if (matchesSenderDomain(serviceLabel, senderDomain)) {
    return { isLeak: false };
  }

  return {
    isLeak: true,
    reason: `Email from ${senderDomain} to alias labeled for ${serviceLabel}`,
  };
}
