-- =============================================
-- v2-014 / v2-030: email-event tracking + push tokens
-- =============================================

-- Hard-bounce tracking on aliases. Aliases auto-disable after 3 hard bounces.
ALTER TABLE identities ADD COLUMN IF NOT EXISTS bounce_count INTEGER DEFAULT 0;

-- Expo push token for mobile notifications (one device per user for now).
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS expo_push_token TEXT;

-- Marks identities the user has reviewed/kept in autopilot so they are
-- excluded from future stale scans (v2-031).
ALTER TABLE identities ADD COLUMN IF NOT EXISTS autopilot_reviewed_at TIMESTAMPTZ;
