import twilio from 'twilio';
import { getAuthUser } from '@/lib/auth';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthUser(request);
    if (auth.error) return Response.json({ error: auth.error }, { status: 401 });

    const supabase = getSupabaseServiceClient();

    const { data: identity, error } = await supabase
      .from('identities')
      .select('id, phone_provider_sid')
      .eq('id', params.id)
      .eq('user_id', auth.userId!)
      .eq('type', 'phone')
      .eq('status', 'active')
      .single();

    if (error || !identity) {
      return Response.json({ error: 'Phone not found' }, { status: 404 });
    }

    // Release from Twilio
    if (identity.phone_provider_sid) {
      try {
        const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
        await client.incomingPhoneNumbers(identity.phone_provider_sid).remove();
      } catch {
        // Continue even if Twilio release fails
      }
    }

    // Delete all SMS messages for this number
    await supabase
      .from('sms_messages')
      .delete()
      .eq('identity_id', params.id);

    await supabase
      .from('identities')
      .update({ status: 'killed', released_at: new Date().toISOString() })
      .eq('id', params.id);

    await logAudit({
      userId: auth.userId!,
      action: 'phone_released',
      resourceType: 'identity',
      resourceId: params.id,
      metadata: {},
      request,
    });

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
