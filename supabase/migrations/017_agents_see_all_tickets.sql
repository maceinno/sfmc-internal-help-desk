-- ============================================================================
-- 017_agents_see_all_tickets.sql
-- Agents can READ every ticket, not only their own teams'.
--
-- Requested 2026-08-19: agents need to search across departments — a loan
-- number frequently lands in whichever queue the person happened to pick,
-- and a Closing agent could previously reach 336 of 3,616 tickets.
--
-- This is the read side catching up with decisions already taken elsewhere:
--
--   * 006_agents_can_update_visible_tickets.sql already granted agents UPDATE
--     on any ticket they can SEE, with the note "Zendesk parity: agents own
--     the queue". Read stayed narrower, so that grant was bounded by team.
--   * `lib/permissions/assert-ticket-access.ts` — the server-side gate used
--     by reply, merge, CC and attachment routes — already returns ok for ANY
--     agent on ANY ticket, for all three actions.
--
-- So an agent could already reply to and merge a ticket via the API; they
-- simply could not load it. Widening SELECT makes the model consistent
-- rather than introducing a new capability.
--
-- Employees are UNCHANGED: still their own tickets, CC'd tickets,
-- collaborations, and branch/region scope where granted.
--
-- Knock-on effects, deliberately accepted:
--   * Agent views that are not department-scoped ("All Unsolved", "All New",
--     "Solved", "Recently Updated") now list every department for agents.
--     Department-scoped view groups are built from the agent's own
--     departments in the UI and are not affected.
--   * Because 006 keys UPDATE off can_see_ticket, agents can now also edit
--     tickets in other departments. That is the intent — "find and open any
--     ticket" is no use if the ticket is read-only once opened.
-- ============================================================================

CREATE OR REPLACE FUNCTION can_see_ticket(p_ticket_id text) RETURNS boolean AS $$
DECLARE
  v_uid      text   := get_current_user_id();
  v_role     text   := get_user_role();
  v_teams    text[] := get_user_team_ids();
  v_branch   uuid   := get_user_branch_id();
  v_region   uuid   := get_user_region_id();
  v_ticket   RECORD;
BEGIN
  -- Admins and agents can see everything. (Was: admin only.)
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

  -- Agent team match is now covered by the role check above, but the branch
  -- and region arms below still matter for employees who manage a branch or
  -- region without being agents.
  IF v_teams IS NOT NULL AND v_ticket.assigned_team IS NOT NULL
     AND v_ticket.assigned_team = ANY(v_teams) THEN
    RETURN true;
  END IF;

  -- Branch access: creator or assignee in the managed branch
  IF v_branch IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM profiles
       WHERE id IN (v_ticket.created_by, v_ticket.assigned_to)
         AND branch_id = v_branch
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
