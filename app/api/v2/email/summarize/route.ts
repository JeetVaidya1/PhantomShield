import { classifyEmail } from '@/lib/email/classifier';
import { summarizeEmail } from '@/lib/email/summarizer';
import { checkRateLimit, RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    // Verify shared secret (called from VPS, not users)
    const authHeader = request.headers.get('authorization');
    const sharedSecret = process.env.EMAIL_WEBHOOK_SECRET;

    if (!authHeader || !sharedSecret || authHeader !== `Bearer ${sharedSecret}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { subject, from, body_preview, user_id } = body;

    if (!subject || !from) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Rate limit AI summarization per user
    if (user_id) {
      const rl = await checkRateLimit({
        key: user_id,
        config: RATE_LIMITS.aiSummary,
        userId: user_id,
        action: 'email/summarize',
      });
      const rlResponse = rateLimitResponse(rl);
      if (rlResponse) return rlResponse;
    }

    // Truncate body to 2000 chars for cost control + security
    const safePreview = (body_preview || '').slice(0, 2000);

    const type = await classifyEmail(subject, from, safePreview);

    let summary: string | null = null;
    if (type === 'marketing') {
      summary = await summarizeEmail(subject, safePreview);
    }

    return Response.json({ type, summary });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
