-- =============================================
-- v2-038: family invites
-- =============================================
-- A pending invite is a family_members row with status='pending', an
-- invite_email, and a NULL user_id (filled in when the invitee accepts).
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS invite_email TEXT;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Parental controls for child accounts (v2-039).
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS max_aliases INTEGER;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS phone_disabled BOOLEAN DEFAULT false;
