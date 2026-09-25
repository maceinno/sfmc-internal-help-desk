-- ============================================================================
-- 021_branch_managers_all_branches.sql
-- Branch managers see tickets from EVERY branch they are given, not only one.
--
-- Client decision 2026-09-25 ("Yes, honour all branches").
--
-- THE MISMATCH THIS CLOSES
--   012_managed_branch_ids.sql added `profiles.managed_branch_ids text[]`, and
--   the admin Users screen writes it ("Managed Branches (N selected)"), as does
--   the app's own rule (`getManagedBranchIds` in lib/permissions/policies.ts).
--   But `can_see_ticket` (last redefined in 017) still called
--   `get_user_branch_id()`, which returns only the single legacy
--   `managed_branch_id`. Row-level security therefore filtered out every
--   ticket from a manager's other branches before the app ever saw them.
--
--   Measured on the PREVIEW database 2026-09-25 (service-role reads): 16 users
--   have branch access; 3 have more than one branch listed (5, 13 and 3
--   branches); roughly 10, 331 and 326 tickets were hidden from them. Not
--   measured on production.
--
-- WHAT CHANGES
--   * New helper `get_user_branch_ids()` — the managed_branch_ids list, falling
--     back to the legacy single branch when the list is empty. Same rule as
--     the app's `getManagedBranchIds`.
--   * `can_see_ticket` is redefined IDENTICALLY to 017 except the branch arm,
--     which now matches ANY branch in that list.
--
--   Everything keyed off can_see_ticket widens for these managers in step —
--   reading the ticket, its messages and attachments, adding a CC, replying.
--   That matches what the server already allowed them for their FIRST branch
--   and what the app's own rule already said about the rest.
--
-- SAFETY
--   * Idempotent: CREATE OR REPLACE only; safe to run more than once.
--   * Compared as TEXT (`branch_id::text = ANY(...)`) on purpose. The list is
--     text[]; casting it to uuid[] would make one malformed entry throw inside
--     can_see_ticket and break EVERY ticket read for that user.
--   * Expand-only: no column is dropped or renamed, `get_user_branch_id()` is
--     left in place, and no application code calls either function, so old
--     and new app code both run correctly against this schema.
--   * Agents, admins, creators, assignees, CC'd users and collaborators are
--     unaffected — those arms are unchanged and run first.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_branch_ids() RETURNS text[] AS $$
  SELECT CASE
           WHEN coalesce(array_length(managed_branch_ids, 1), 0) > 0
             THEN managed_branch_ids
           WHEN managed_branch_id IS NOT NULL
             THEN ARRAY[managed_branch_id::text]
           ELSE NULL
         END
    FROM profiles
   WHERE id = coalesce(auth.jwt() ->> 'profile_id', auth.jwt() ->> 'sub')
     AND has_branch_access = true
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION can_see_ticket(p_ticket_id text) RETURNS boolean AS $$
DECLARE
  v_uid      text   := get_current_user_id();
  v_role     text   := get_user_role();
  v_teams    text[] := get_user_team_ids();
  v_branches text[] := get_user_branch_ids();
  v_region   uuid   := get_user_region_id();
  v_ticket   RECORD;
BEGIN
  -- Admins and agents can see everything.
  IF v_role IN ('admin', 'agent') THEN
    RETURN true;
  END IF;

  SELECT created_by, assigned_to, assigned_team
    INTO v_ticket
    FROM tickets
   WHERE id = p_ticket_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Creator can always see their own ticket
  IF v_ticket.created_by = v_uid THEN
    RETURN true;
  END IF;

  -- Assignee can see their ticket
  IF v_ticket.assigned_to = v_uid THEN
    RETURN true;
  END IF;

  -- CC'd users can see the ticket
  IF EXISTS (
    SELECT 1 FROM ticket_cc WHERE ticket_id = p_ticket_id AND user_id = v_uid
  ) THEN
    RETURN true;
  END IF;

  -- Collaborators can see the ticket
  IF EXISTS (
    SELECT 1 FROM ticket_collaborators WHERE ticket_id = p_ticket_id AND user_id = v_uid
  ) THEN
    RETURN true;
  END IF;

  -- Team match (kept from 017 for non-agent team members)
  IF v_teams IS NOT NULL AND v_ticket.assigned_team IS NOT NULL
     AND v_ticket.assigned_team = ANY(v_teams) THEN
    RETURN true;
  END IF;

  -- Branch access: creator or assignee in ANY of the managed branches.
  -- (Was: the single legacy managed_branch_id only.)
  IF v_branches IS NOT NULL AND array_length(v_branches, 1) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM profiles
       WHERE id IN (v_ticket.created_by, v_ticket.assigned_to)
         AND branch_id::text = ANY(v_branches)
    ) THEN
      RETURN true;
    END IF;
  END IF;

  -- Region access: creator or assignee in the managed region
  IF v_region IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM profiles
       WHERE id IN (v_ticket.created_by, v_ticket.assigned_to)
         AND region_id = v_region
    ) THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ── Verification (run by hand; read-only) ──────────────────────────────────
-- Managers whose list differs from the legacy single branch — the people this
-- migration changes anything for:
--
--   select id, name, managed_branch_id, managed_branch_ids
--     from profiles
--    where has_branch_access
--      and coalesce(array_length(managed_branch_ids, 1), 0) > 1;
