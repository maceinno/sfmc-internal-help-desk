-- System events in the message thread.
--
-- Status changes, assignment changes, etc. are now written as message
-- rows with is_system=true so they appear inline in the conversation
-- alongside replies and notes. Renderers detect the flag and present
-- them as small inline event lines instead of full message cards.
--
-- We don't add a new table because:
--   * the chronological merge of events + replies is free,
--   * realtime subscriptions on `messages` carry events too,
--   * RLS policies on messages already cover the access model.

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

-- Index helps the conversation queries that filter system events out
-- when building reply emails (which want only human messages).
CREATE INDEX IF NOT EXISTS idx_messages_ticket_is_system
  ON messages (ticket_id, is_system, created_at);
