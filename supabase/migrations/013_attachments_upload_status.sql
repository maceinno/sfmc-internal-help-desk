-- 013: attachment upload-status tracking for direct-to-Supabase signed uploads
--
-- /api/upload/sign creates the attachments row before the file PUT lands in
-- Supabase Storage. The status column lets us hide in-flight rows from peers
-- so the ticket thread doesn't render half-uploaded files. /api/upload/finalize
-- flips the status to 'ready' once the blob is confirmed in storage.
--
-- Existing rows are backfilled to 'ready' by the column DEFAULT (PG 11+ stores
-- the default in metadata, no table rewrite). The legacy /api/upload route
-- inserts without specifying status, so it picks up 'ready' too and keeps
-- working as a deprecated fallback.

ALTER TABLE attachments
  ADD COLUMN status text NOT NULL DEFAULT 'ready'
  CHECK (status IN ('pending', 'ready'));

DROP POLICY attachments_select ON attachments;

CREATE POLICY attachments_select ON attachments
  FOR SELECT
  USING (
    can_see_ticket(ticket_id)
    AND (
      status = 'ready'
      OR uploaded_by = get_current_user_id()
    )
  );
