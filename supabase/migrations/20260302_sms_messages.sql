-- =============================================
-- SMS Messages table for Twilio inbound SMS
-- =============================================

CREATE TABLE sms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  body TEXT NOT NULL,
  extracted_code TEXT,
  twilio_message_sid TEXT UNIQUE,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;

-- Users can only read their own SMS messages
CREATE POLICY "Users can read own sms messages"
  ON sms_messages FOR SELECT USING (auth.uid() = user_id);

-- Only service role can insert (from webhook)
-- No INSERT policy for regular users

CREATE INDEX idx_sms_messages_identity ON sms_messages(identity_id, received_at DESC);
CREATE INDEX idx_sms_messages_user ON sms_messages(user_id, received_at DESC);
CREATE INDEX idx_sms_messages_to_number ON sms_messages(to_number);
