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
      if (userId) {
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

      // Find user by stripe customer ID and downgrade
      const { data: settings } = await supabase
        .from('user_settings')
        .select('user_id')
        .eq('stripe_customer_id', customerId)
        .single();

      if (settings) {
        await supabase
          .from('user_settings')
          .update({ plan_tier: 'free' })
          .eq('user_id', settings.user_id);
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
