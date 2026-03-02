import { getSupabaseClient } from '@/lib/supabase';
import { loginSchema } from '@/lib/validations/v2-schemas';
import { rateLimit, RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit';
import { logAudit } from '@/lib/audit';

const PHANTOM_EMAIL_DOMAIN = 'phantom.local';

function usernameToEmail(username: string): string {
  return `${username}@${PHANTOM_EMAIL_DOMAIN}`;
}

export async function POST(request: Request) {
  try {
    // Rate limit by IP
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    const rl = rateLimit(ip, RATE_LIMITS.authLogin);
    const blocked = rateLimitResponse(rl);
    if (blocked) return blocked;

    // Parse and validate input
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { username, password } = parsed.data;
    const syntheticEmail = usernameToEmail(username);

    // Authenticate via Supabase
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: syntheticEmail,
      password,
    });

    if (error || !data.session) {
      // Skip audit log for failed logins — we don't have a valid user_id
      // and the audit_log FK constraint requires a real auth.users reference
      return Response.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    const userMetadata = data.user.user_metadata;

    // Audit log
    await logAudit({
      userId: data.user.id,
      action: 'login',
      resourceType: 'auth',
      metadata: { username },
      request,
    });

    return Response.json({
      user: {
        id: data.user.id,
        username: userMetadata?.username || username,
        encryption_salt: userMetadata?.encryption_salt || null,
        key_check: userMetadata?.key_check || null,
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
    });
  } catch (err) {
    console.error('[auth/login] Unexpected error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
