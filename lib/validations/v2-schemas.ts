import { z } from 'zod';

/**
 * Strip HTML tags from a string.
 */
function stripHtml(input: string): string {
  // Remove script/style tags and their contents first
  let cleaned = input.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  // Then remove remaining HTML tags
  cleaned = cleaned.replace(/<[^>]*>/g, '');
  return cleaned.trim();
}

// ---- Alias Creation ----
export const aliasLabelSchema = z
  .string()
  .max(100, 'Label must be 100 characters or less')
  .transform(stripHtml)
  .pipe(
    z
      .string()
      .min(1, 'Label is required')
      .regex(
        /^[a-zA-Z0-9\s\-_.,!?'()&]+$/,
        'Label contains invalid characters'
      )
  );

// ---- Company Name ----
export const companyNameSchema = z
  .string()
  .max(200, 'Company name must be 200 characters or less')
  .transform(stripHtml)
  .pipe(z.string().min(1, 'Company name is required'));

// ---- Phone Number (E.164) ----
export const phoneNumberSchema = z
  .string()
  .regex(/^\+[1-9]\d{1,14}$/, 'Phone number must be in E.164 format');

// ---- GDPR Request ----
export const gdprRequestSchema = z.object({
  company_name: companyNameSchema,
  company_email: z.string().email('Invalid email address'),
  request_type: z
    .enum(['gdpr_erasure', 'ccpa_deletion'])
    .default('gdpr_erasure'),
  identity_id: z.string().uuid('Invalid identity ID'),
});

// ---- Honeypot Creation ----
export const honeypotCreateSchema = z.object({
  label: aliasLabelSchema,
  planted_at_service: z
    .string()
    .max(200)
    .transform(stripHtml)
    .pipe(z.string().min(1)),
  planted_at_url: z.string().url('Invalid URL').optional(),
});

// ---- Digest Settings ----
export const digestSettingsSchema = z.object({
  email_forward_mode: z.enum(['full', 'summary', 'digest']),
  digest_frequency: z.enum(['daily', 'weekly']),
  digest_time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be in HH:MM format'),
  digest_day: z.number().int().min(0).max(6).optional(),
});

// ---- Domain Report ----
export const domainReportSchema = z.object({
  domain_id: z.string().uuid('Invalid domain ID'),
});

// ---- Service Label (for identity) ----
export const serviceLabelSchema = z
  .string()
  .max(200)
  .transform(stripHtml)
  .pipe(z.string().min(1))
  .optional();

// ---- Leak Dismiss ----
export const leakDismissSchema = z.object({
  id: z.string().uuid('Invalid leak detection ID'),
});

// ---- Nuke Confirmation ----
export const nukeConfirmSchema = z.object({
  confirm: z.literal(true),
});

// ---- Export Format ----
export const exportFormatSchema = z.object({
  format: z.enum(['json', 'csv']).default('json'),
});

// ---- Auth: Signup ----
export const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be 30 characters or less')
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    'Username can only contain letters, numbers, hyphens, and underscores'
  )
  .transform((s) => s.toLowerCase());

export const masterPasswordSchema = z
  .string()
  .min(8, 'Master password must be at least 8 characters')
  .max(128, 'Master password must be 128 characters or less');

export const signupSchema = z.object({
  username: usernameSchema,
  password: masterPasswordSchema,
  encryption_salt: z
    .string()
    .regex(/^[0-9a-f]{64}$/, 'Invalid encryption salt'),
  key_check: z
    .string()
    .min(1, 'Key check is required'),
});

export const loginSchema = z.object({
  username: usernameSchema,
  password: masterPasswordSchema,
});

// Re-export stripHtml for use in other modules
export { stripHtml };
