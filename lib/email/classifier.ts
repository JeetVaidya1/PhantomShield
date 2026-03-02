import OpenAI from 'openai';

const TRANSACTIONAL_KEYWORDS = [
  'receipt',
  'order confirmation',
  'order shipped',
  'your order',
  'shipping confirmation',
  'delivery notification',
  'password reset',
  'reset your password',
  'verify your email',
  'email verification',
  'two-factor',
  '2fa',
  'login alert',
  'security alert',
  'sign-in',
  'account verification',
  'payment received',
  'invoice',
  'transaction',
  'booking confirmation',
  'reservation confirmed',
  'appointment',
];

const MARKETING_KEYWORDS = [
  'unsubscribe',
  'newsletter',
  'weekly digest',
  'monthly update',
  'special offer',
  'limited time',
  'exclusive deal',
  'sale',
  'discount',
  'promo',
  'promotion',
  'flash sale',
  'free shipping',
  'save up to',
  '% off',
  'coupon',
  'deal of the day',
  'recommended for you',
  'you might like',
  'we miss you',
  'come back',
];

export type EmailType = 'transactional' | 'marketing';

/**
 * Classify email as transactional or marketing.
 * Uses heuristic first, AI fallback for ambiguous cases.
 */
export async function classifyEmail(
  subject: string,
  from: string,
  bodyPreview: string
): Promise<EmailType> {
  const combined = `${subject} ${bodyPreview}`.toLowerCase();

  // Heuristic: check for transactional signals
  for (const kw of TRANSACTIONAL_KEYWORDS) {
    if (combined.includes(kw)) {
      return 'transactional';
    }
  }

  // Heuristic: check for marketing signals
  for (const kw of MARKETING_KEYWORDS) {
    if (combined.includes(kw)) {
      return 'marketing';
    }
  }

  // AI fallback for ambiguous emails
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 10,
      messages: [
        {
          role: 'system',
          content:
            'Classify this email as "transactional" or "marketing". Reply with only one word.',
        },
        {
          role: 'user',
          content: `Subject: ${subject}\nFrom: ${from}\nPreview: ${bodyPreview.slice(0, 500)}`,
        },
      ],
    });

    const answer = response.choices[0]?.message?.content?.trim().toLowerCase();
    if (answer === 'transactional') return 'transactional';
    return 'marketing';
  } catch {
    // Default to marketing if AI fails
    return 'marketing';
  }
}
