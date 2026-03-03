import twilio from 'twilio';
import { getAuthUser } from '@/lib/auth';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';

const INCLUDED_PHONES_PRO = 1;
const COOLDOWN_DAYS = 15;
const SUPPORTED_COUNTRIES = ['US', 'CA'] as const;
type CountryCode = typeof SUPPORTED_COUNTRIES[number];

function getTwilioClient() {
  return twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
}

export async function GET(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (auth.error) return Response.json({ error: auth.error }, { status: 401 });

    const supabase = getSupabaseServiceClient();

    // Fetch phones and user settings in parallel
    const [phonesResult, settingsResult] = await Promise.all([
      supabase
        .from('identities')
        .select('id, alias_email, phone_provider_sid, status, created_at, type, released_at')
        .eq('user_id', auth.userId!)
        .eq('type', 'phone')
        .order('created_at', { ascending: false }),
      supabase
        .from('user_settings')
        .select('phone_addon_count')
        .eq('user_id', auth.userId!)
        .single(),
    ]);

    if (phonesResult.error) return Response.json({ error: 'Failed to fetch phones' }, { status: 500 });

    const addonCount = settingsResult.data?.phone_addon_count ?? 0;

    const phones = (phonesResult.data || []).map((p) => ({
      id: p.id,
      phone_number: p.alias_email, // stored in alias_email for phone type
      status: p.status,
      created_at: p.created_at,
      released_at: p.released_at,
    }));

    // Find most recent release within cooldown window
    const cooldownCutoff = new Date(Date.now() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const recentRelease = phones.find((p) => p.released_at && p.released_at > cooldownCutoff);
    const cooldownExpires = recentRelease?.released_at
      ? new Date(new Date(recentRelease.released_at).getTime() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString()
      : null;

    return Response.json({
      phones,
      phone_addon_count: addonCount,
      max_phones: INCLUDED_PHONES_PRO + addonCount,
      cooldown_expires: cooldownExpires,
    });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (auth.error) return Response.json({ error: auth.error }, { status: 401 });

    const supabase = getSupabaseServiceClient();

    // Check plan tier + addon count
    const { data: settings } = await supabase
      .from('user_settings')
      .select('plan_tier, phone_addon_count')
      .eq('user_id', auth.userId!)
      .single();

    if (!settings || settings.plan_tier !== 'pro') {
      return Response.json({ error: 'Phone numbers require a Pro plan' }, { status: 403 });
    }

    const addonCount = settings.phone_addon_count ?? 0;
    const maxPhones = INCLUDED_PHONES_PRO + addonCount;

    // Check limit
    const { count } = await supabase
      .from('identities')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', auth.userId!)
      .eq('type', 'phone')
      .eq('status', 'active');

    if ((count ?? 0) >= maxPhones) {
      return Response.json(
        { error: `You've reached your limit of ${maxPhones} phone number${maxPhones === 1 ? '' : 's'}. Purchase an addon for more.` },
        { status: 403 }
      );
    }

    // Check 15-day cooldown after releasing a number
    const cooldownCutoff = new Date(Date.now() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentRelease } = await supabase
      .from('identities')
      .select('released_at')
      .eq('user_id', auth.userId!)
      .eq('type', 'phone')
      .gt('released_at', cooldownCutoff)
      .order('released_at', { ascending: false })
      .limit(1)
      .single();

    if (recentRelease?.released_at) {
      const cooldownExpiry = new Date(new Date(recentRelease.released_at).getTime() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
      return Response.json(
        { error: 'Cooldown active after releasing a number', cooldown_expires: cooldownExpiry.toISOString() },
        { status: 403 }
      );
    }

    // Parse country code from request body
    let countryCode: CountryCode = 'US';
    try {
      const body = await request.json();
      if (body.country_code && SUPPORTED_COUNTRIES.includes(body.country_code)) {
        countryCode = body.country_code;
      }
    } catch {
      // Default to US if no body
    }

    // Provision from Twilio
    const client = getTwilioClient();
    const available = await client.availablePhoneNumbers(countryCode).local.list({ limit: 1, smsEnabled: true });
    if (available.length === 0) {
      return Response.json({ error: `No numbers available for ${countryCode}. Try again shortly.` }, { status: 503 });
    }

    const purchased = await client.incomingPhoneNumbers.create({
      phoneNumber: available[0].phoneNumber,
      smsUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://phantom-shield-theta.vercel.app'}/api/webhooks/twilio-sms`,
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
