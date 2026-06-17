import type { EmailType } from './classifier';

export type MutePolicy = 'all' | 'transactional_only' | 'silent';

export interface ForwardDecisionInput {
  type: EmailType;
  mutePolicy?: MutePolicy | null;
  /** True once a relationship has been retired (killed or honeypot). */
  retired?: boolean;
}

/**
 * Decide whether an inbound email should reach the user's real inbox.
 *
 * A retired relationship never forwards — you left, so their mail stops
 * (a honeypot still *receives* it as a tripwire, it just isn't delivered).
 * Otherwise the per-relationship mute policy governs:
 *   - 'silent'             -> nothing forwards
 *   - 'transactional_only' -> only OTPs/receipts/shipping (the default)
 *   - 'all'                -> everything forwards
 *
 * Marketing that isn't forwarded is still summarized into the digest upstream.
 */
export function shouldForward(input: ForwardDecisionInput): boolean {
  if (input.retired) return false;

  const policy: MutePolicy = input.mutePolicy ?? 'transactional_only';
  switch (policy) {
    case 'silent':
      return false;
    case 'all':
      return true;
    case 'transactional_only':
    default:
      return input.type === 'transactional';
  }
}
