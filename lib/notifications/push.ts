import { getSupabaseServiceClient } from '@/lib/supabase';

/**
 * Push notifications via Expo's push service (v2-014 / v2-030).
 *
 * Device Expo push tokens are stored on user_settings.expo_push_token. Delivery
 * is best-effort: a missing token or transient Expo error is logged-and-skipped,
 * never thrown, so a notification failure can't break the calling webhook/cron.
 */

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

export interface PushMessage {
  title: string;
  body: string;
  /** Deep-link target consumed by the mobile app's notification handler. */
  deepLink?: string;
  priority?: 'default' | 'high';
  data?: Record<string, unknown>;
}

export interface PushResult {
  sent: boolean;
  reason?: string;
}

/** Look up a user's Expo push token, if any. */
async function getExpoPushToken(userId: string): Promise<string | null> {
  const supabase = getSupabaseServiceClient();
  const { data } = await supabase
    .from('user_settings')
    .select('expo_push_token')
    .eq('user_id', userId)
    .single();
  return (data?.expo_push_token as string | undefined) ?? null;
}

/** Send a push notification to a single user. Never throws. */
export async function sendPushNotification(
  userId: string,
  message: PushMessage
): Promise<PushResult> {
  try {
    const token = await getExpoPushToken(userId);
    if (!token) {
      return { sent: false, reason: 'no_token' };
    }

    const res = await fetch(EXPO_PUSH_ENDPOINT, {
      method: 'POST',
      // Cap the call so a slow Expo endpoint can't stall the webhook/cron caller.
      signal: AbortSignal.timeout(5000),
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        to: token,
        title: message.title,
        body: message.body,
        priority: message.priority ?? 'default',
        data: { ...(message.data ?? {}), deepLink: message.deepLink ?? null },
      }),
    });

    if (!res.ok) {
      return { sent: false, reason: `expo_${res.status}` };
    }
    return { sent: true };
  } catch (error: unknown) {
    return { sent: false, reason: error instanceof Error ? error.message : 'unknown' };
  }
}
