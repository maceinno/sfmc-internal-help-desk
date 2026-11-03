-- ============================================================================
-- 023_email_send_log.sql
-- Record every email the help desk TRIES to send, and what Resend answered.
--
-- Client decision 2026-11-03 ("Yes"), after a report that end users were not
-- getting reply emails.
--
-- WHY email_events IS NOT ENOUGH
--   email_events (016) holds only what Resend's webhook reports back. Measured
--   2026-11-03 (service-role read, shared preview/production project): event
--   types ever recorded are delivered 63,903, bounced 673 (last 2026-08-24),
--   delivery_delayed 1 — never sent / suppressed / complained / failed. So an
--   address Resend refuses, or a send that throws before reaching Resend,
--   leaves NO row anywhere; only a server log line. Felicia Pena
--   (fpena@sfmc.com) had no row of any kind after 2026-07-23 despite 38 tickets
--   created — visible only as an absence.
--
--   This table is written by send() in src/lib/email/notify.ts, one row per
--   attempt, BEFORE anything Resend reports later.
--
-- SAFE IN EITHER ORDER, SAFE TO RE-RUN
--   CREATE ... IF NOT EXISTS throughout. Old code never touches this table; new
--   code treats a failed insert as a logged warning and never lets it stop the
--   email, and the admin route treats a missing table as "no attempts yet".
--
-- Service-role only, like email_events: RLS on with NO policies.
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_send_log (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    attempted_at    timestamptz NOT NULL DEFAULT now(),
    recipient       text NOT NULL,               -- lower-cased address
    subject         text,
    ticket_id       text,                        -- no FK: keep the log if a ticket is deleted
    outcome         text NOT NULL
                    CHECK (outcome IN ('accepted', 'refused', 'error')),
                    -- accepted: Resend took it (resend_email_id set)
                    -- refused:  Resend answered with an error object
                    -- error:    the call threw (network, missing key, ...)
    resend_email_id text,                        -- joins to email_events.resend_email_id
    error_name      text,
    error_message   text
);

CREATE INDEX IF NOT EXISTS idx_email_send_log_recipient
    ON email_send_log (recipient, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_send_log_outcome
    ON email_send_log (outcome, attempted_at DESC);

ALTER TABLE email_send_log ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: service-role access only (send() + admin route).
