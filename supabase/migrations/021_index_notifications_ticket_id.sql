-- notifications.ticket_id is a foreign key with no index.
--
-- Every other child of `tickets` is indexed on ticket_id — attachments,
-- messages, custom_field_values, sla_alerts, ticket_cc, ticket_collaborators.
-- This one was missed, and it had accumulated 11,130 sequential scans.
--
-- Small (1,125 rows), so the per-scan cost is low and this is a tidy-up rather
-- than a fix. It is here because an unindexed FK on a growing child table gets
-- expensive silently, and because a fleet audit that flags FKs only above 5,000
-- rows would never have caught this one — it was found by reading ticket_id
-- coverage across every child table instead.
--
-- Already applied to prod and preview (created concurrently by hand
-- 2026-09-18), so this file is a no-op on both. Not `concurrently` here: the
-- migration runner may wrap a file in a transaction, where that is an error,
-- and an existing index means `if not exists` takes no lock.
create index if not exists notifications_ticket_id_idx
  on public.notifications (ticket_id);
