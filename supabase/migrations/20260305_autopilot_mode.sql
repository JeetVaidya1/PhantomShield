-- =============================================
-- v2-030 / v2-031: autopilot mode selector
-- =============================================
-- 'manual'  -> notify the user; they review and kill/keep.
-- 'auto_kill' -> automatically kill identities past the threshold.
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS autopilot_mode TEXT DEFAULT 'manual';
