-- 018_sla_alerts.sql
-- ---------------------------------------------------------------------------
-- Ledger of SLA alerts already sent, so each one goes out exactly once.
--
-- Before this, /api/sla/check suppressed duplicates by looking for a
-- notification row from the last hour. That made an overdue ticket re-alert
-- its assignee EVERY HOUR until it was solved — a ticket overdue for ten days
-- would have produced ~240 emails. The client asked for one warning and one
-- breach notice per ticket instead.
--
-- Keyed on the DEADLINE, not just the ticket, because a ticket's SLA clock
-- legitimately restarts: the first-reply clock is replaced by a next-reply
-- clock once an agent answers, giving a new deadline. A later cycle must be
-- able to warn again, while the same cycle never warns twice.
--
-- The UNIQUE constraint is what actually enforces "once": the job inserts
-- first and only emails if the insert created a row, so two overlapping cron
-- runs cannot both send. Do not drop it.
--
-- Service-role only, following email_events: written by the cron via the
-- admin client. RLS on with NO policies, so anon / authenticated clients
-- cannot read it directly.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sla_alerts (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id    text NOT NULL REFERENCES tickets (id) ON DELETE CASCADE,
    -- 'warning' = the at-risk heads-up; 'breach' = the deadline has passed.
    stage        text NOT NULL CHECK (stage IN ('warning', 'breach')),
    -- Which clock was running: firstReply | nextReply.
    metric       text NOT NULL,
    -- The deadline this alert was about. Part of the key so a restarted
    -- clock (new deadline) can alert again.
    sla_deadline timestamptz NOT NULL,
    -- How many people it went to, for support questions after the fact.
    recipients   integer NOT NULL DEFAULT 0,
    sent_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (ticket_id, stage, metric, sla_deadline)
);

-- "Have we already alerted this ticket?" is the only read.
CREATE INDEX IF NOT EXISTS idx_sla_alerts_ticket ON sla_alerts (ticket_id, sent_at DESC);

ALTER TABLE sla_alerts ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: service-role access only (the SLA cron).
