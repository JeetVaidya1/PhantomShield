-- =============================================
-- Phantom Shield V2 Migration
-- All new tables, RLS policies, and indexes
-- Domain: phantomdefender.com
-- =============================================

-- =============================================
-- Multi-domain support
-- =============================================
CREATE TABLE alias_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL UNIQUE,
  active BOOLEAN DEFAULT true,
  blocked_count INTEGER DEFAULT 0,
  mx_verified BOOLEAN DEFAULT false,
  dkim_configured BOOLEAN DEFAULT false,
  dkim_public_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE alias_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active domains"
  ON alias_domains FOR SELECT USING (active = true);

-- =============================================
-- Extend identities table
-- =============================================
ALTER TABLE identities ADD COLUMN IF NOT EXISTS domain_id UUID REFERENCES alias_domains(id);
ALTER TABLE identities ADD COLUMN IF NOT EXISTS reverse_alias_token TEXT UNIQUE;
ALTER TABLE identities ADD COLUMN IF NOT EXISTS reply_enabled BOOLEAN DEFAULT true;
ALTER TABLE identities ADD COLUMN IF NOT EXISTS phone_provider TEXT DEFAULT 'twilio';
ALTER TABLE identities ADD COLUMN IF NOT EXISTS phone_provider_sid TEXT;
ALTER TABLE identities ADD COLUMN IF NOT EXISTS is_honeypot BOOLEAN DEFAULT false;
ALTER TABLE identities ADD COLUMN IF NOT EXISTS service_label TEXT;
ALTER TABLE identities ADD COLUMN IF NOT EXISTS simplelogin_alias_id BIGINT;

-- =============================================
-- Tracker logging
-- =============================================
CREATE TABLE tracker_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID REFERENCES identities(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  trackers_stripped INTEGER NOT NULL DEFAULT 0,
  tracker_companies TEXT[] DEFAULT '{}',
  links_cleaned INTEGER NOT NULL DEFAULT 0,
  email_from TEXT,
  email_subject TEXT,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tracker_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own tracker logs"
  ON tracker_logs FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX idx_tracker_logs_user_date ON tracker_logs(user_id, processed_at DESC);

-- =============================================
-- Leak detection
-- =============================================
CREATE TABLE leak_detections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID REFERENCES identities(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  expected_sender TEXT NOT NULL,
  actual_sender_domain TEXT NOT NULL,
  actual_sender_email TEXT,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  dismissed BOOLEAN DEFAULT false
);

ALTER TABLE leak_detections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own leak detections"
  ON leak_detections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own leak detections"
  ON leak_detections FOR UPDATE USING (auth.uid() = user_id);

-- =============================================
-- Company privacy scores (public, aggregated)
-- =============================================
CREATE TABLE company_privacy_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_domain TEXT NOT NULL UNIQUE,
  company_name TEXT,
  total_aliases INTEGER DEFAULT 0,
  leak_detections INTEGER DEFAULT 0,
  leak_rate NUMERIC(5,4) DEFAULT 0,
  avg_days_to_first_spam NUMERIC(10,2),
  privacy_score INTEGER DEFAULT 50,
  last_computed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE company_privacy_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read company scores"
  ON company_privacy_scores FOR SELECT USING (true);

-- =============================================
-- Email summaries + digest
-- =============================================
CREATE TABLE email_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID REFERENCES identities(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email_from TEXT NOT NULL,
  email_subject TEXT NOT NULL,
  summary TEXT,
  email_type TEXT NOT NULL DEFAULT 'marketing',
  full_body_encrypted TEXT,
  digest_batch_id UUID,
  forwarded BOOLEAN DEFAULT false,
  trackers_stripped INTEGER DEFAULT 0,
  received_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE email_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own email summaries"
  ON email_summaries FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX idx_email_summaries_user_date ON email_summaries(user_id, received_at DESC);

CREATE TABLE digest_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email_count INTEGER DEFAULT 0,
  sent BOOLEAN DEFAULT false,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE digest_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own digest batches"
  ON digest_batches FOR SELECT USING (auth.uid() = user_id);

-- =============================================
-- Honeypots
-- =============================================
CREATE TABLE honeypot_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID REFERENCES identities(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  trigger_from_email TEXT NOT NULL,
  trigger_from_domain TEXT NOT NULL,
  trigger_subject TEXT,
  triggered_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE honeypot_triggers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own honeypot triggers"
  ON honeypot_triggers FOR SELECT USING (auth.uid() = user_id);

-- =============================================
-- GDPR/CCPA requests
-- =============================================
CREATE TABLE deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  identity_id UUID REFERENCES identities(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  company_email TEXT NOT NULL,
  request_type TEXT NOT NULL DEFAULT 'gdpr_erasure',
  status TEXT DEFAULT 'sent',
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  response_deadline TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE deletion_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own deletion requests"
  ON deletion_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own deletion requests"
  ON deletion_requests FOR UPDATE USING (auth.uid() = user_id);

CREATE TABLE company_privacy_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_domain TEXT NOT NULL UNIQUE,
  company_name TEXT NOT NULL,
  privacy_email TEXT,
  dpo_email TEXT,
  privacy_page_url TEXT,
  verified BOOLEAN DEFAULT false,
  contributed_by_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE company_privacy_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read company contacts"
  ON company_privacy_contacts FOR SELECT USING (true);

-- =============================================
-- Autopilot
-- =============================================
CREATE TABLE autopilot_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  scan_date DATE NOT NULL DEFAULT CURRENT_DATE,
  stale_aliases INTEGER DEFAULT 0,
  spam_only_aliases INTEGER DEFAULT 0,
  unused_phones INTEGER DEFAULT 0,
  auto_killed INTEGER DEFAULT 0,
  user_reviewed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE autopilot_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own autopilot scans"
  ON autopilot_scans FOR SELECT USING (auth.uid() = user_id);

-- =============================================
-- User settings extensions
-- =============================================
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS email_forward_mode TEXT DEFAULT 'full';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS digest_frequency TEXT DEFAULT 'daily';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS digest_time TIME DEFAULT '08:00';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS digest_day INTEGER DEFAULT 1;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS autopilot_enabled BOOLEAN DEFAULT false;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS autopilot_auto_kill_days INTEGER DEFAULT 90;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS nuke_contact_number TEXT;

-- =============================================
-- Audit log
-- =============================================
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
-- Users can ONLY read their own audit logs — NO insert/update/delete policies
-- Only service role can write to audit_log
CREATE POLICY "Users can read own audit logs"
  ON audit_log FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX idx_audit_log_user_date ON audit_log(user_id, created_at DESC);

-- =============================================
-- Family plan
-- =============================================
CREATE TABLE families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT DEFAULT 'My Family',
  max_members INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE families ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Family members can read family"
  ON families FOR SELECT
  USING (
    owner_id = auth.uid() OR
    id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
  );

CREATE TABLE family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(family_id, user_id)
);

ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Family members can read members"
  ON family_members FOR SELECT
  USING (
    family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
  );
