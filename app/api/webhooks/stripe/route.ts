import Stripe from 'stripe';
import { getSupabaseServiceClient } from '@/lib/supabase';

function getStripe() { return new Stripe(process.env.STRIPE_SECRET_KEY!); }

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (!sig) {
    return Response.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('[stripe/webhook] Signature verification failed:', err);
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = getSupabaseServiceClient();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      const addonType = session.metadata?.addon_type;

      if (userId && addonType === 'extra_phone') {
        // Addon purchase: increment phone_addon_count
        const { data: current } = await supabase
          .from('user_settings')
          .select('phone_addon_count')
          .eq('user_id', userId)
          .single();

        const currentCount = current?.phone_addon_count ?? 0;
        await supabase
          .from('user_settings')
          .update({ phone_addon_count: currentCount + 1 })
          .eq('user_id', userId);
      } else if (userId) {
        // Regular Pro checkout
        await supabase
          .from('user_settings')
          .upsert(
            {
              user_id: userId,
              plan_tier: 'pro',
              stripe_customer_id: String(session.customer),
            },
            { onConflict: 'user_id' }
          );
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = String(subscription.customer);
      const isAddon = subscription.metadata?.addon_type === 'extra_phone';

      // Find user by stripe customer ID
      const { data: settings } = await supabase
        .from('user_settings')
        .select('user_id, phone_addon_count')
        .eq('stripe_customer_id', customerId)
        .single();

      if (settings) {
        if (isAddon) {
          // Addon cancellation: decrement phone_addon_count (min 0)
          const newCount = Math.max(0, (settings.phone_addon_count ?? 0) - 1);
          await supabase
            .from('user_settings')
            .update({ phone_addon_count: newCount })
            .eq('user_id', settings.user_id);
        } else {
          // Main Pro subscription cancellation: downgrade to free
          await supabase
            .from('user_settings')
            .update({ plan_tier: 'free' })
            .eq('user_id', settings.user_id);
        }
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = String(invoice.customer);
      console.warn('[stripe/webhook] Payment failed for customer:', customerId);
      break;
    }
  }

  return Response.json({ received: true });
}
