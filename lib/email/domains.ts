import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Multi-domain alias management (v2-012).
 *
 * Aliases are spread across several sending domains so that one domain getting
 * blocklisted doesn't take down every user's aliases. A domain is eligible only
 * when it is active, MX-verified, and below the auto-deactivation threshold.
 * See ARCHITECTURE-V2-FINAL.md Section 5.
 */

/** A domain auto-deactivates once this many blocked reports accumulate. */
export const BLOCKED_THRESHOLD = 10;

export interface AliasDomain {
  id: string;
  domain: string;
  active: boolean;
  blocked_count: number;
  mx_verified: boolean;
}

/** Return all active, MX-verified domains below the blocked threshold. */
export async function getActiveDomains(
  supabase: SupabaseClient
): Promise<AliasDomain[]> {
  const { data, error } = await supabase
    .from('alias_domains')
    .select('id, domain, active, blocked_count, mx_verified')
    .eq('active', true)
    .eq('mx_verified', true)
    .lt('blocked_count', BLOCKED_THRESHOLD)
    .order('blocked_count', { ascending: true });

  if (error) {
    throw new Error('Failed to load active domains');
  }
  return (data ?? []) as AliasDomain[];
}

/**
 * Pick a domain for a user's next alias. Prefers domains the user does not
 * already have aliases on (to spread footprint), then the least-blocked domain.
 * Throws when no eligible domain exists.
 */
export async function selectDomainForNewAlias(
  supabase: SupabaseClient,
  userId: string
): Promise<AliasDomain> {
  const domains = await getActiveDomains(supabase);
  if (domains.length === 0) {
    throw new Error('No alias domains available right now. Please try again later.');
  }

  // Which domains does this user already use?
  const { data: usedRows } = await supabase
    .from('identities')
    .select('domain_id')
    .eq('user_id', userId)
    .eq('type', 'email');

  const usedDomainIds = new Set(
    (usedRows ?? [])
      .map((r: { domain_id: string | null }) => r.domain_id)
      .filter((id): id is string => Boolean(id))
  );

  const unused = domains.filter((d) => !usedDomainIds.has(d.id));
  // getActiveDomains already orders by blocked_count asc, so [0] is the best pick.
  const pool = unused.length > 0 ? unused : domains;
  return pool[0];
}
