import Stripe from 'stripe';
import { getAuthUser } from '@/lib/auth';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { z } from 'zod';

function getStripe() { return new Stripe(process.env.STRIPE_SECRET_KEY!); }

const addonSchema = z.object({
  addon_type: z.enum(['extra_phone', 'extra_aliases']),
});

export async function POST(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (auth.error) {
      return Response.json({ error: auth.error }, { status: 401 });
    }

    const body = await request.json();
    const parsed = addonSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: 'Invalid addon type' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();
    const { data: settings } = await supabase
      .from('user_settings')
      .select('stripe_customer_id, plan_tier')
      .eq('user_id', auth.userId)
      .single();

    if (settings?.plan_tier !== 'pro') {
      return Response.json({ error: 'Pro plan required for add-ons' }, { status: 403 });
    }

    const customerId = String(settings.stripe_customer_id || '');
    if (!customerId) {
      return Response.json({ error: 'No billing account found' }, { status: 400 });
    }

    // Select the right price ID based on addon type
    const priceId =
      parsed.data.addon_type === 'extra_phone'
        ? process.env.STRIPE_PHONE_ADDON_PRICE_ID!
        : process.env.STRIPE_ALIAS_ADDON_PRICE_ID!;

    const userId = auth.userId!;
    const params: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://phantomdefender.com'}/dashboard?addon=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://phantomdefender.com'}/dashboard/upgrade`,
      metadata: {
        user_id: userId,
        addon_type: parsed.data.addon_type,
      },
    };
    const session = await getStripe().checkout.sessions.create(params);

    await logAudit({
      userId,
      action: 'stripe_addon_checkout',
      resourceType: 'billing',
      metadata: { addon_type: parsed.data.addon_type, session_id: session.id },
      request,
    });

    return Response.json({ url: session.url });
  } catch (err) {
    console.error('[stripe/addon] Error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
