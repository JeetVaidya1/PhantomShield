import type { PhoneProvider } from '@/lib/phone/provider';
import { TwilioProvider } from '@/lib/phone/providers/twilio';

/**
 * Resolve the configured {@link PhoneProvider} from the PHONE_PROVIDER env var.
 *
 * Only 'twilio' is supported — the V2 architecture dropped the Telnyx switch
 * (see CLAUDE.md). Unknown or missing values throw a descriptive error rather
 * than silently falling back, so misconfiguration fails fast at startup.
 */
export function getPhoneProvider(): PhoneProvider {
  const provider = process.env.PHONE_PROVIDER;

  if (!provider) {
    throw new Error('PHONE_PROVIDER env var is not set (expected: "twilio")');
  }

  switch (provider) {
    case 'twilio':
      return new TwilioProvider();
    default:
      throw new Error(`Unknown PHONE_PROVIDER: "${provider}" (supported: "twilio")`);
  }
}
