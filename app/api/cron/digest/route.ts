import { getSupabaseServiceClient } from '@/lib/supabase';
import { verifyCronSecret } from '@/lib/webhooks/verify';
import { runDigestCron } from '@/lib/email/digest';

/**
 * POST /api/cron/digest (v2-021) — runs hourly via Vercel Cron.
 * Compiles and sends digests for users whose digest time matches this hour.
 */
export async function POST(request: Request) {
  try {
    const authorization = request.headers.get('authorization') || '';
    if (!verifyCronSecret({ authorization })) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseServiceClient();
    const result = await runDigestCron(supabase, new Date());

    return Response.json(result);
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Vercel Cron triggers GET; delegate to the same handler.
export async function GET(request: Request) {
  return POST(request);
}
