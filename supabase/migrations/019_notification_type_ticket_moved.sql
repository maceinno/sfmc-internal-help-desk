-- 019_notification_type_ticket_moved.sql
-- ---------------------------------------------------------------------------
-- Allow the notifications table to carry 'ticket_moved'.
--
-- Moving a ticket to another department previously left only a line in the
-- ticket's own history — the receiving department got no email and nothing in
-- their bell panel, so a handover was invisible unless somebody happened to
-- open that ticket. The new department-move notification writes one of these
-- rows per recipient, alongside the email.
--
-- The existing constraint is dropped by NAME (verified against the live
-- database: notifications_type_check) with a defensive fallback, because a
-- column-level CHECK is auto-named and the name is not guaranteed. Widening a
-- CHECK cannot fail against existing rows: every current value is still
-- allowed. Safe to run more than once.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    existing_name text;
BEGIN
    SELECT conname
      INTO existing_name
      FROM pg_constraint
     WHERE conrelid = 'notifications'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) LIKE '%sla_at_risk%'
     LIMIT 1;

    IF existing_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE notifications DROP CONSTRAINT %I', existing_name);
    END IF;
END $$;

ALTER TABLE notifications
    ADD CONSTRAINT notifications_type_check
    CHECK (type IN (
        'tagged',
        'collaborator_added',
        'reply_on_tagged',
        'sla_at_risk',
        'ticket_moved'
    ));
