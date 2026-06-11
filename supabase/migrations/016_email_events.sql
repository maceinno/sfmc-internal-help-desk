-- 016_email_events.sql
-- ---------------------------------------------------------------------------
-- Email delivery event log (Resend webhooks).
--
-- Captures Resend delivery events — sent / delivered / delivery_delayed /
-- bounced / complained / failed / suppressed — so admins get in-app
-- visibility into deliverability, especially the "bounce list" of addresses
-- Resend has suppressed. Previously there was NO bounce tracking (no webhook,
-- no table, no UI): a hard-bounced recipient silently received nothing — not
-- even their account invite — and only a server log recorded it.
--
-- Service-role only. The webhook (/api/webhooks/resend-events) writes via the
-- admin client, and the admin page reads via an admin-checked server route
-- (/api/admin/email-events). RLS is enabled with NO policies, so anon /
-- authenticated clients cannot read this table directly.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS email_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    svix_id         text UNIQUE,                 -- webhook delivery id; dedupes Svix redeliveries
    resend_email_id text,                        -- data.email_id
    event_type      text NOT NULL,               -- sent|delivered|delivery_delayed|bounced|complained|failed|suppressed
    recipient       text NOT NULL,               -- lower(data.to[0])
    from_address    text,
    subject         text,
    bounce_type     text,                         -- data.bounce.type    e.g. 'Permanent'
    bounce_subtype  text,                         -- data.bounce.subType e.g. 'Suppressed'
    reason          text,                         -- data.bounce.message / complaint detail
    payload         jsonb NOT NULL,               -- full event, for forensics
    event_at        timestamptz NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- "Latest event for this recipient" + "recent failures" are the two reads.
CREATE INDEX IF NOT EXISTS idx_email_events_recipient ON email_events (recipient, event_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_events_type_at   ON email_events (event_type, event_at DESC);

ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: service-role access only (webhook + admin route).
