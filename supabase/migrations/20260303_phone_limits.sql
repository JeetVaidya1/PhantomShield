-- Phone limits: 1 included with Pro + addon purchases + 15-day cooldown
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS phone_addon_count INTEGER DEFAULT 0;
ALTER TABLE identities ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;
