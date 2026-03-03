import twilio from 'twilio';
import { getAuthUser } from '@/lib/auth';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';

const MAX_PHONES_PRO = 2;

function getTwilioClient() {
  return twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
}

export async function GET(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (auth.error) return Response.json({ error: auth.error }, { status: 401 });

    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from('identities')
      .select('id, alias_email, phone_provider_sid, status, created_at, type')
      .eq('user_id', auth.userId!)
      .eq('type', 'phone')
      .order('created_at', { ascending: false });

    if (error) return Response.json({ error: 'Failed to fetch phones' }, { status: 500 });

    const phones = (data || []).map((p) => ({
      id: p.id,
      phone_number: p.alias_email, // stored in alias_email for phone type
      status: p.status,
      created_at: p.created_at,
    }));

    return Response.json({ phones });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (auth.error) return Response.json({ error: auth.error }, { status: 401 });

    const supabase = getSupabaseServiceClient();

    // Check plan tier
    const { data: settings } = await supabase
      .from('user_settings')
      .select('plan_tier')
      .eq('user_id', auth.userId!)
      .single();

    if (!settings || settings.plan_tier !== 'pro') {
      return Response.json({ error: 'Phone numbers require a Pro plan' }, { status: 403 });
    }

    // Check limit
    const { count } = await supabase
      .from('identities')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', auth.userId!)
      .eq('type', 'phone')
      .eq('status', 'active');

    if ((count ?? 0) >= MAX_PHONES_PRO) {
      return Response.json({ error: `Pro plan limited to ${MAX_PHONES_PRO} phone numbers` }, { status: 403 });
    }

    // Provision from Twilio
    const client = getTwilioClient();
    const available = await client.availablePhoneNumbers('US').local.list({ limit: 1, smsEnabled: true });
    if (available.length === 0) {
      return Response.json({ error: 'No numbers available. Try again shortly.' }, { status: 503 });
    }

    const purchased = await client.incomingPhoneNumbers.create({
      phoneNumber: available[0].phoneNumber,
      smsUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://phantom-shield.vercel.app'}/api/webhooks/twilio-sms`,
      smsMethod: 'POST',
    });

    // Save to DB
    const { data: identity, error } = await supabase
      .from('identities')
      .insert({
        user_id: auth.userId!,
        alias_email: purchased.phoneNumber,
        type: 'phone',
        status: 'active',
        phone_provider: 'twilio',
        phone_provider_sid: purchased.sid,
      })
      .select()
      .single();

    if (error) {
      // Try to release the Twilio number if DB insert fails
      try { await client.incomingPhoneNumbers(purchased.sid).remove(); } catch {}
      return Response.json({ error: 'Failed to save phone number' }, { status: 500 });
    }

    await logAudit({
      userId: auth.userId!,
      action: 'phone_provisioned',
      resourceType: 'identity',
      resourceId: identity.id,
      metadata: { phone_number: purchased.phoneNumber },
      request,
    });

    return Response.json({
      phone: {
        id: identity.id,
        phone_number: purchased.phoneNumber,
        status: 'active',
        created_at: identity.created_at,
      },
    }, { status: 201 });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
