import { getSupabaseServiceClient } from '@/lib/supabase';
import { verifyTwilioSignature } from '@/lib/webhooks/verify';

function extractOTPCode(body: string): string | null {
  const match = body.match(/\b(\d{4,8})\b/);
  return match ? match[1] : null;
}

export async function POST(request: Request) {
  try {
    // Parse form-encoded body (Twilio sends application/x-www-form-urlencoded)
    const formData = await request.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = value.toString();
    });

    // Verify Twilio signature
    const twilioSignature = request.headers.get('x-twilio-signature') || '';
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://phantom-shield-theta.vercel.app'}/api/webhooks/twilio-sms`;

    if (!verifyTwilioSignature(webhookUrl, params, twilioSignature)) {
      console.warn('[twilio-sms] Invalid signature');
      return new Response('Forbidden', { status: 403 });
    }

    const from = params.From || '';
    const to = params.To || '';
    const body = params.Body || '';
    const messageSid = params.MessageSid || '';

    if (!from || !to || !body) {
      return new Response('Bad Request', { status: 400 });
    }

    const supabase = getSupabaseServiceClient();

    // Look up which identity owns this phone number
    const { data: identity, error: lookupError } = await supabase
      .from('identities')
      .select('id, user_id')
      .eq('alias_email', to) // phone number stored in alias_email
      .eq('type', 'phone')
      .eq('status', 'active')
      .single();

    if (lookupError || !identity) {
      console.warn(`[twilio-sms] No active identity found for number: ${to}`);
      // Return 200 so Twilio doesn't retry
      return new Response('<Response></Response>', {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // Extract OTP code if present
    const extractedCode = extractOTPCode(body);

    // Store the message
    const { error: insertError } = await supabase
      .from('sms_messages')
      .insert({
        identity_id: identity.id,
        user_id: identity.user_id,
        from_number: from,
        to_number: to,
        body,
        extracted_code: extractedCode,
        twilio_message_sid: messageSid || null,
        received_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('[twilio-sms] Failed to store message:', insertError.message);
    }

    // Return empty TwiML response (no auto-reply — receive-only)
    return new Response('<Response></Response>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (err) {
    console.error('[twilio-sms] Webhook error:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}
