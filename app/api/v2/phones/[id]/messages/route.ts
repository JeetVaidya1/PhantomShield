import { getAuthUser } from '@/lib/auth';
import { getSupabaseServiceClient } from '@/lib/supabase';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthUser(request);
    if (auth.error) return Response.json({ error: auth.error }, { status: 401 });

    const supabase = getSupabaseServiceClient();

    // Verify ownership
    const { data: identity } = await supabase
      .from('identities')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', auth.userId!)
      .eq('type', 'phone')
      .single();

    if (!identity) {
      return Response.json({ error: 'Phone not found' }, { status: 404 });
    }

    // Fetch SMS messages (stored by the Twilio webhook)
    const { data: messages, error } = await supabase
      .from('sms_messages')
      .select('id, from_number, body, received_at, extracted_code')
      .eq('identity_id', params.id)
      .order('received_at', { ascending: false })
      .limit(50);

    if (error) {
      // Table might not exist yet — return empty
      return Response.json({ messages: [] });
    }

    const mapped = (messages || []).map((m) => ({
      id: m.id,
      from: m.from_number,
      body: m.body,
      received_at: m.received_at,
      extracted_code: m.extracted_code,
    }));

    return Response.json({ messages: mapped });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
