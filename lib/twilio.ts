/**
 * Backwards-compatibility shim. The Twilio integration moved to
 * lib/phone/providers/twilio.ts behind the PhoneProvider interface (v2-008).
 * Prefer importing getPhoneProvider() from '@/lib/phone/factory'.
 */
export { TwilioProvider } from '@/lib/phone/providers/twilio';
export type {
  PhoneProvider,
  BoughtNumber,
  InboundSMS,
  BuyNumberParams,
} from '@/lib/phone/provider';
