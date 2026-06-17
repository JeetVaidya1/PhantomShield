-- =============================================
-- Relationship lifecycle: per-vendor identities with a clean exit
-- =============================================
-- An identity = one relationship with one vendor. It is born at signup
-- (vendor_domain captured for attribution + GDPR routing), lives under a
-- per-relationship mute policy, and is retired with a clean exit (kill or
-- leave-a-tripwire honeypot).

-- The vendor this identity was created for. Drives leak attribution (exact
-- match beats fuzzy service_label) and GDPR/CCPA routing on retire.
ALTER TABLE identities ADD COLUMN IF NOT EXISTS vendor_domain TEXT;

-- When the relationship was retired (kill or honeypot). NULL = still active.
ALTER TABLE identities ADD COLUMN IF NOT EXISTS retired_at TIMESTAMPTZ;

-- Per-relationship inbox policy:
--   'transactional_only' (default) -> only OTPs/receipts/shipping reach you
--   'all'                          -> forward everything
--   'silent'                       -> forward nothing (archive/honeypot only)
ALTER TABLE identities
  ADD COLUMN IF NOT EXISTS mute_policy TEXT DEFAULT 'transactional_only';

-- status now includes 'retired': a former relationship kept alive as a
-- honeypot tripwire (is_honeypot flipped true) so we catch a vendor that
-- ignores the deletion request or sold the address on.
COMMENT ON COLUMN identities.status IS
  'active | disabled | deactivated | killed | retired';

-- Fast lookup of a user''s live relationships and retired tripwires.
CREATE INDEX IF NOT EXISTS idx_identities_user_status
  ON identities (user_id, status);
CREATE INDEX IF NOT EXISTS idx_identities_vendor_domain
  ON identities (vendor_domain);
