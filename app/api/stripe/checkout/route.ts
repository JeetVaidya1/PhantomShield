import Stripe from 'stripe';
import { getAuthUser } from '@/lib/auth';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (auth.error) {
      return Response.json({ error: auth.error }, { status: 401 });
    }

    const userId = auth.userId!;
    const supabase = getSupabaseServiceClient();

    // Check if user already has a Stripe customer ID
    const { data: settings } = await supabase
      .from('user_settings')
      .select('stripe_customer_id, plan_tier')
      .eq('user_id', userId)
      .single();

    if (settings?.plan_tier === 'pro') {
      return Response.json({ error: 'Already on Pro plan' }, { status: 400 });
    }

    let customerId = settings?.stripe_customer_id
      ? String(settings.stripe_customer_id)
      : '';

    if (!customerId) {
      // Create Stripe customer
      const customer = await getStripe().customers.create({
        metadata: { user_id: userId },
      });
      customerId = customer.id;

      // Save customer ID
      await supabase
        .from('user_settings')
        .upsert({
          user_id: userId,
          stripe_customer_id: customerId,
        }, { onConflict: 'user_id' });
    }

    // Create checkout session for Pro plan ($9.99/mo)
    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [
        {
          price: process.env.STRIPE_PRO_PRICE_ID!,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://phantomdefender.com'}/dashboard?upgraded=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://phantomdefender.com'}/dashboard/upgrade`,
      metadata: { user_id: userId },
    });

    await logAudit({
      userId: userId,
      action: 'stripe_checkout_created',
      resourceType: 'billing',
      metadata: { session_id: session.id },
      request,
    });

    return Response.json({ url: session.url });
  } catch (err) {
    console.error('[stripe/checkout] Error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
