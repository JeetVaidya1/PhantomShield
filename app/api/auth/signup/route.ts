import { getSupabaseServiceClient, getSupabaseClient } from '@/lib/supabase';
import { signupSchema } from '@/lib/validations/v2-schemas';
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

    const rl = rateLimit(ip, RATE_LIMITS.authSignup);
    const blocked = rateLimitResponse(rl);
    if (blocked) return blocked;

    // Parse and validate input
    const body = await request.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { username, password, encryption_salt, key_check } = parsed.data;
    const syntheticEmail = usernameToEmail(username);

    // Create user via Supabase admin API (auto-confirmed, no email verification)
    const adminClient = getSupabaseServiceClient();
    const { data: createData, error: createError } =
      await adminClient.auth.admin.createUser({
        email: syntheticEmail,
        password,
        email_confirm: true, // Auto-confirm — no verification email sent
        user_metadata: {
          username,
          encryption_salt,
          key_check,
        },
      });

    if (createError) {
      // Check for duplicate username
      if (
        createError.message?.includes('already been registered') ||
        createError.message?.includes('already exists')
      ) {
        return Response.json(
          { error: 'Username already taken' },
          { status: 409 }
        );
      }
      console.error('[auth/signup] Create user failed:', createError.message);
      return Response.json(
        { error: 'Failed to create account' },
        { status: 500 }
      );
    }

    // Sign in immediately to get session tokens
    const supabase = getSupabaseClient();
    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email: syntheticEmail,
        password,
      });

    if (signInError || !signInData.session) {
      // User created but sign-in failed — still return success
      // Client can retry login
      console.error('[auth/signup] Auto sign-in failed:', signInError?.message);

      await logAudit({
        userId: createData.user.id,
        action: 'signup_success_signin_failed',
        resourceType: 'auth',
        request,
      });

      return Response.json(
        {
          user: {
            id: createData.user.id,
            username,
          },
          session: null,
          message: 'Account created. Please log in.',
        },
        { status: 201 }
      );
    }

    // Audit log
    await logAudit({
      userId: createData.user.id,
      action: 'signup',
      resourceType: 'auth',
      metadata: { username },
      request,
    });

    return Response.json(
      {
        user: {
          id: createData.user.id,
          username,
        },
        session: {
          access_token: signInData.session.access_token,
          refresh_token: signInData.session.refresh_token,
          expires_at: signInData.session.expires_at,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('[auth/signup] Unexpected error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
