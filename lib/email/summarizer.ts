import OpenAI from 'openai';

const MAX_BODY_CHARS = 2000;
const MAX_SUMMARY_WORDS = 20;

/**
 * Generate a one-line summary for a marketing email.
 * Body is truncated to 2000 chars for cost control and security.
 */
export async function summarizeEmail(
  subject: string,
  bodyText: string
): Promise<string> {
  const truncatedBody = bodyText.slice(0, MAX_BODY_CHARS);

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 60,
      messages: [
        {
          role: 'system',
          content: `Summarize this email in one sentence, maximum ${MAX_SUMMARY_WORDS} words. Be concise and informative.`,
        },
        {
          role: 'user',
          content: `Subject: ${subject}\n\n${truncatedBody}`,
        },
      ],
    });

    const summary = response.choices[0]?.message?.content?.trim() || subject;

    // Enforce word limit
    const words = summary.split(/\s+/);
    if (words.length > MAX_SUMMARY_WORDS) {
      return words.slice(0, MAX_SUMMARY_WORDS).join(' ') + '...';
    }

    return summary;
  } catch {
    return subject; // Fallback to subject line
  }
}
