/**
 * PhoneProvider interface — V2 phone abstraction.
 *
 * RECEIVE-ONLY by design (see CLAUDE.md "V2 Changes from V1"): Phantom Defender
 * never sends outbound SMS, so this interface intentionally has NO sendSMS method.
 * Numbers exist purely to receive OTPs and inbound messages. This deliberately
 * deviates from ARCHITECTURE-V2-FINAL.md Section 4A (which predates the receive-only
 * decision) — the curated CLAUDE.md override is authoritative.
 */

/** Result of provisioning a new phone number. */
export interface BoughtNumber {
  /** E.164 format, e.g. +15551234567 */
  number: string;
  /** Provider-specific identifier used for later management (release, config). */
  providerSid: string;
  /** Recurring monthly cost in USD. */
  monthlyCost: number;
}

/** Normalized inbound SMS extracted from a provider webhook payload. */
export interface InboundSMS {
  /** Sender number in E.164 format. */
  from: string;
  /** Receiving (our) number in E.164 format. */
  to: string;
  /** Message body text. */
  text: string;
  /** Provider-specific message identifier. */
  messageId: string;
}

/** Parameters for provisioning a number. */
export interface BuyNumberParams {
  areaCode?: string;
  /** ISO country code, e.g. 'US' or 'CA'. Defaults to 'US' when unset. */
  country?: string;
}

/**
 * A pluggable phone-number provider. Implementations wrap a vendor SDK
 * (currently only Twilio) behind a stable, receive-only contract.
 */
export interface PhoneProvider {
  /** Stable provider identifier, e.g. 'twilio'. */
  readonly name: string;

  /** Provision a new receive-only number. */
  buyNumber(params: BuyNumberParams): Promise<BoughtNumber>;

  /** Release a previously provisioned number by its provider SID. */
  releaseNumber(providerSid: string): Promise<void>;

  /**
   * Verify an inbound webhook is authentic.
   * @param headers Lower-cased header map from the request.
   * @param body Raw request body (form-encoded or JSON, provider-specific).
   * @param url Absolute URL the webhook was delivered to (required by some
   *   signature schemes, e.g. Twilio).
   */
  verifyWebhook(headers: Record<string, string>, body: string, url: string): boolean;

  /** Parse a provider webhook payload into a normalized inbound SMS. */
  parseInboundSMS(body: Record<string, unknown>): InboundSMS;
}
