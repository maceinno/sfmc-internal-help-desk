-- Drop the legacy `ticket_types_handled` column on profiles.
--
-- We had three overlapping per-user fields driving "what work this agent
-- can take": team_ids (which team), departments (which departments they
-- support), and ticket_types_handled (which ticket types). The assignee
-- dropdown filter was wired to `departments`, the routing rules use
-- `team_ids`, and `ticket_types_handled` was effectively dead weight —
-- collected via the admin UI but not consumed by any code path.
--
-- Defensive backfill: if a row has ticket_types_handled values but an
-- empty/null departments array, copy them over before the drop. Today's
-- prod data has zero such rows (verified 2026-04-28), so this is a
-- no-op in practice — kept for safety in case anyone is running this
-- against a different snapshot.

UPDATE profiles
SET departments = ticket_types_handled
WHERE (departments IS NULL OR array_length(departments, 1) IS NULL)
  AND ticket_types_handled IS NOT NULL
  AND array_length(ticket_types_handled, 1) > 0;

ALTER TABLE profiles DROP COLUMN ticket_types_handled;
