import twilio from 'twilio';
import { verifyTwilioSignature } from '@/lib/webhooks/verify';
import type {
  PhoneProvider,
  BuyNumberParams,
  BoughtNumber,
  InboundSMS,
} from '@/lib/phone/provider';

const SUPPORTED_COUNTRIES = ['US', 'CA'] as const;
type SupportedCountry = (typeof SUPPORTED_COUNTRIES)[number];

function isSupportedCountry(value: string): value is SupportedCountry {
  return (SUPPORTED_COUNTRIES as readonly string[]).includes(value);
}

/** Twilio number costs roughly $1.15/mo for US/CA local numbers. */
const TWILIO_MONTHLY_COST_USD = 1.15;

/**
 * Twilio implementation of {@link PhoneProvider}. Receive-only: it provisions
 * numbers and parses inbound SMS, but never sends outbound messages.
 */
export class TwilioProvider implements PhoneProvider {
  readonly name = 'twilio';

  private client() {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) {
      throw new Error('Twilio credentials (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN) not configured');
    }
    return twilio(sid, token);
  }

  private smsWebhookUrl(): string {
    const base = process.env.NEXT_PUBLIC_APP_URL || 'https://phantom-shield-theta.vercel.app';
    return `${base}/api/webhooks/twilio-sms`;
  }

  async buyNumber(params: BuyNumberParams): Promise<BoughtNumber> {
    const country: SupportedCountry =
      params.country && isSupportedCountry(params.country) ? params.country : 'US';

    const client = this.client();
    const available = await client
      .availablePhoneNumbers(country)
      .local.list({
        limit: 1,
        smsEnabled: true,
        ...(params.areaCode ? { areaCode: Number(params.areaCode) } : {}),
      });

    if (available.length === 0) {
      throw new Error(`No Twilio numbers available for ${country}`);
    }

    const purchased = await client.incomingPhoneNumbers.create({
      phoneNumber: available[0].phoneNumber,
      smsUrl: this.smsWebhookUrl(),
      smsMethod: 'POST',
    });

    return {
      number: purchased.phoneNumber,
      providerSid: purchased.sid,
      monthlyCost: TWILIO_MONTHLY_COST_USD,
    };
  }

  async releaseNumber(providerSid: string): Promise<void> {
    const client = this.client();
    await client.incomingPhoneNumbers(providerSid).remove();
  }

  verifyWebhook(
    _headers: Record<string, string>,
    body: string,
    url: string
  ): boolean {
    const signature = _headers['x-twilio-signature'] || '';
    // Twilio signs the form params, not the raw body. The caller passes the
    // already-parsed params re-encoded as JSON when needed; here we accept the
    // form-encoded params parsed into an object.
    let params: Record<string, string> = {};
    try {
      params = JSON.parse(body) as Record<string, string>;
    } catch {
      params = {};
    }
    return verifyTwilioSignature(url, params, signature);
  }

  parseInboundSMS(body: Record<string, unknown>): InboundSMS {
    return {
      from: String(body.From ?? ''),
      to: String(body.To ?? ''),
      text: String(body.Body ?? ''),
      messageId: String(body.MessageSid ?? ''),
    };
  }
}
