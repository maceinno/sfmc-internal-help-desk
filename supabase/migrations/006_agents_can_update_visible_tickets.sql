-- ============================================================================
-- 006_agents_can_update_visible_tickets.sql
-- Broaden tickets UPDATE policy so agents can edit any ticket they can see.
--
-- Prior policy restricted agents to tickets where they were assignee or
-- creator, which silently blocked status/priority/assignee changes from the
-- ticket detail UI even though the controls were visible. Zendesk parity:
-- agents own the queue, so any agent can triage any visible ticket.
-- ============================================================================

DROP POLICY IF EXISTS tickets_update ON tickets;

CREATE POLICY tickets_update ON tickets
  FOR UPDATE
  USING (
    get_user_role() = 'admin'
    OR (get_user_role() = 'agent' AND can_see_ticket(id))
    OR created_by = get_current_user_id()
    OR assigned_to = get_current_user_id()
  );
