import { z } from 'zod';
import { getAuthUser } from '@/lib/auth';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { encryptForwardingEmailAtRest } from '@/lib/crypto/server';

const schema = z.object({
  forwarding_email: z.string().min(1, 'Forwarding email is required').email('Invalid forwarding email'),
});

/**
 * PATCH /api/v2/settings/forwarding — change the forwarding address on all of
 * the user's email aliases. Stored encrypted at rest.
 */
export async function PATCH(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (auth.error) {
      return Response.json({ error: auth.error }, { status: 401 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();
    const { error } = await supabase
      .from('identities')
      .update({ forwarding_email: encryptForwardingEmailAtRest(parsed.data.forwarding_email) })
      .eq('user_id', auth.userId!)
      .eq('type', 'email');

    if (error) {
      return Response.json({ error: 'Failed to update forwarding email' }, { status: 500 });
    }

    await logAudit({
      userId: auth.userId!,
      action: 'forwarding_email_updated',
      resourceType: 'user_settings',
      request,
    });

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
