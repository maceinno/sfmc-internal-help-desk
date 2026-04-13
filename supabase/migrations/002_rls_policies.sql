-- ============================================================================
-- 002_rls_policies.sql
-- Row Level Security policies for the SFMC Internal Help Desk Portal
--
-- Auth integration: Clerk user IDs are stored in profiles.id.
-- Clerk JWTs are passed to Supabase; we use auth.jwt() ->> 'sub' to get
-- the Clerk user ID.  Helper functions below look up role and team_ids
-- from the profiles table so policies stay readable.
-- ============================================================================

-- ============================================================================
-- HELPER FUNCTIONS
-- Reusable lookups against profiles using the Clerk JWT subject claim.
-- SECURITY DEFINER so the functions can read profiles even when RLS is active.
-- STABLE because they return the same value within a single transaction.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_current_user_id() RETURNS text AS $$
  SELECT auth.jwt() ->> 'sub'
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION get_user_role() RETURNS text AS $$
  SELECT role FROM profiles WHERE id = auth.jwt() ->> 'sub'
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_user_team_ids() RETURNS text[] AS $$
  SELECT team_ids FROM profiles WHERE id = auth.jwt() ->> 'sub'
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_user_branch_id() RETURNS uuid AS $$
  SELECT managed_branch_id FROM profiles
   WHERE id = auth.jwt() ->> 'sub'
     AND has_branch_access = true
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_user_region_id() RETURNS uuid AS $$
  SELECT managed_region_id FROM profiles
   WHERE id = auth.jwt() ->> 'sub'
     AND has_regional_access = true
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================================
-- Helper: can the current user see a given ticket?
-- Centralises the visibility logic so message/attachment/cc/etc. policies
-- can simply call this instead of duplicating the complex predicate.
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
  -- Admin can see everything
  IF v_role = 'admin' THEN
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

  -- Agent: team match
  IF v_role = 'agent' AND v_ticket.assigned_team IS NOT NULL
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


-- ############################################################################
--  PROFILES
-- ############################################################################

-- Everyone can read profiles (needed for user lists, avatars, name lookups)
CREATE POLICY profiles_select ON profiles
  FOR SELECT
  USING (true);

-- Only admins can insert profiles (Clerk webhook uses service role key which
-- bypasses RLS, so this policy mainly guards against non-admin API calls)
CREATE POLICY profiles_insert ON profiles
  FOR INSERT
  WITH CHECK (get_user_role() = 'admin');

-- Only admins can update profiles
CREATE POLICY profiles_update ON profiles
  FOR UPDATE
  USING (get_user_role() = 'admin');

-- Only admins can delete profiles
CREATE POLICY profiles_delete ON profiles
  FOR DELETE
  USING (get_user_role() = 'admin');


-- ############################################################################
--  TICKETS
-- ############################################################################

-- SELECT: visibility depends on role, team, branch, region, CC, collaborators
CREATE POLICY tickets_select ON tickets
  FOR SELECT
  USING (can_see_ticket(id));

-- INSERT: any authenticated user can create a ticket
CREATE POLICY tickets_insert ON tickets
  FOR INSERT
  WITH CHECK (auth.jwt() ->> 'sub' IS NOT NULL);

-- UPDATE: creator, assignee, or admin
CREATE POLICY tickets_update ON tickets
  FOR UPDATE
  USING (
    get_user_role() = 'admin'
    OR created_by = get_current_user_id()
    OR assigned_to = get_current_user_id()
  );

-- DELETE: admin only (tickets are generally not deleted, but if needed)
CREATE POLICY tickets_delete ON tickets
  FOR DELETE
  USING (get_user_role() = 'admin');


-- ############################################################################
--  TICKET_CC
-- ############################################################################

-- SELECT: follows parent ticket visibility
CREATE POLICY ticket_cc_select ON ticket_cc
  FOR SELECT
  USING (can_see_ticket(ticket_id));

-- INSERT: anyone who can see the ticket can add CC entries
CREATE POLICY ticket_cc_insert ON ticket_cc
  FOR INSERT
  WITH CHECK (can_see_ticket(ticket_id));

-- DELETE: ticket creator, assignee, or admin
CREATE POLICY ticket_cc_delete ON ticket_cc
  FOR DELETE
  USING (
    get_user_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM tickets t
       WHERE t.id = ticket_id
         AND (t.created_by = get_current_user_id() OR t.assigned_to = get_current_user_id())
    )
  );


-- ############################################################################
--  TICKET_COLLABORATORS
-- ############################################################################

-- SELECT: follows parent ticket visibility
CREATE POLICY ticket_collaborators_select ON ticket_collaborators
  FOR SELECT
  USING (can_see_ticket(ticket_id));

-- INSERT: agents and admins who can see the ticket
CREATE POLICY ticket_collaborators_insert ON ticket_collaborators
  FOR INSERT
  WITH CHECK (
    get_user_role() IN ('admin', 'agent')
    AND can_see_ticket(ticket_id)
  );

-- DELETE: admin or the collaborator themselves
CREATE POLICY ticket_collaborators_delete ON ticket_collaborators
  FOR DELETE
  USING (
    get_user_role() = 'admin'
    OR user_id = get_current_user_id()
  );


-- ############################################################################
--  TICKET_MERGED
-- ############################################################################

-- SELECT: follows parent ticket visibility
CREATE POLICY ticket_merged_select ON ticket_merged
  FOR SELECT
  USING (can_see_ticket(parent_ticket_id));

-- INSERT: admin only (merging is an admin/agent action)
CREATE POLICY ticket_merged_insert ON ticket_merged
  FOR INSERT
  WITH CHECK (get_user_role() IN ('admin', 'agent'));

-- DELETE: admin only
CREATE POLICY ticket_merged_delete ON ticket_merged
  FOR DELETE
  USING (get_user_role() = 'admin');


-- ############################################################################
--  MESSAGES
-- ############################################################################

-- SELECT: same visibility as parent ticket
CREATE POLICY messages_select ON messages
  FOR SELECT
  USING (can_see_ticket(ticket_id));

-- INSERT: any authenticated user can post a reply (on tickets they can see)
CREATE POLICY messages_insert ON messages
  FOR INSERT
  WITH CHECK (
    auth.jwt() ->> 'sub' IS NOT NULL
    AND can_see_ticket(ticket_id)
  );

-- UPDATE: message author or admin (for editing messages)
CREATE POLICY messages_update ON messages
  FOR UPDATE
  USING (
    author_id = get_current_user_id()
    OR get_user_role() = 'admin'
  );

-- DELETE: admin only
CREATE POLICY messages_delete ON messages
  FOR DELETE
  USING (get_user_role() = 'admin');


-- ############################################################################
--  ATTACHMENTS
-- ############################################################################

-- SELECT: same visibility as parent ticket
CREATE POLICY attachments_select ON attachments
  FOR SELECT
  USING (can_see_ticket(ticket_id));

-- INSERT: any authenticated user can upload (on tickets they can see)
CREATE POLICY attachments_insert ON attachments
  FOR INSERT
  WITH CHECK (
    auth.jwt() ->> 'sub' IS NOT NULL
    AND can_see_ticket(ticket_id)
  );

-- DELETE: uploader or admin
CREATE POLICY attachments_delete ON attachments
  FOR DELETE
  USING (
    uploaded_by = get_current_user_id()
    OR get_user_role() = 'admin'
  );


-- ############################################################################
--  CUSTOM_FIELD_VALUES
-- ############################################################################

-- SELECT: follows parent ticket visibility
CREATE POLICY custom_field_values_select ON custom_field_values
  FOR SELECT
  USING (can_see_ticket(ticket_id));

-- INSERT: anyone who can see the ticket
CREATE POLICY custom_field_values_insert ON custom_field_values
  FOR INSERT
  WITH CHECK (can_see_ticket(ticket_id));

-- UPDATE: anyone who can see the ticket
CREATE POLICY custom_field_values_update ON custom_field_values
  FOR UPDATE
  USING (can_see_ticket(ticket_id));

-- DELETE: admin only
CREATE POLICY custom_field_values_delete ON custom_field_values
  FOR DELETE
  USING (get_user_role() = 'admin');


-- ############################################################################
--  NOTIFICATIONS
-- ############################################################################

-- SELECT: only the recipient can see their own notifications
CREATE POLICY notifications_select ON notifications
  FOR SELECT
  USING (to_user_id = get_current_user_id());

-- INSERT: only system/service role should insert notifications.
-- The service role key bypasses RLS. This policy blocks normal users.
CREATE POLICY notifications_insert ON notifications
  FOR INSERT
  WITH CHECK (false);

-- UPDATE: recipient can mark their own notifications as read
CREATE POLICY notifications_update ON notifications
  FOR UPDATE
  USING (to_user_id = get_current_user_id());

-- DELETE: recipient can delete their own notifications
CREATE POLICY notifications_delete ON notifications
  FOR DELETE
  USING (to_user_id = get_current_user_id());


-- ############################################################################
--  CONFIG TABLES (read by everyone, written by admins only)
--  Tables: sla_policies, view_configs, canned_responses, routing_rules,
--          custom_fields, department_schedules, department_categories,
--          branding_config, branches, regions, teams
-- ############################################################################

-- ---------- sla_policies ----------

CREATE POLICY sla_policies_select ON sla_policies
  FOR SELECT USING (true);

CREATE POLICY sla_policies_insert ON sla_policies
  FOR INSERT WITH CHECK (get_user_role() = 'admin');

CREATE POLICY sla_policies_update ON sla_policies
  FOR UPDATE USING (get_user_role() = 'admin');

CREATE POLICY sla_policies_delete ON sla_policies
  FOR DELETE USING (get_user_role() = 'admin');

-- ---------- view_configs ----------

CREATE POLICY view_configs_select ON view_configs
  FOR SELECT USING (true);

CREATE POLICY view_configs_insert ON view_configs
  FOR INSERT WITH CHECK (get_user_role() = 'admin');

CREATE POLICY view_configs_update ON view_configs
  FOR UPDATE USING (get_user_role() = 'admin');

CREATE POLICY view_configs_delete ON view_configs
  FOR DELETE USING (get_user_role() = 'admin');

-- ---------- canned_responses ----------

CREATE POLICY canned_responses_select ON canned_responses
  FOR SELECT USING (true);

CREATE POLICY canned_responses_insert ON canned_responses
  FOR INSERT WITH CHECK (get_user_role() = 'admin');

CREATE POLICY canned_responses_update ON canned_responses
  FOR UPDATE USING (get_user_role() = 'admin');

CREATE POLICY canned_responses_delete ON canned_responses
  FOR DELETE USING (get_user_role() = 'admin');

-- ---------- routing_rules ----------

CREATE POLICY routing_rules_select ON routing_rules
  FOR SELECT USING (true);

CREATE POLICY routing_rules_insert ON routing_rules
  FOR INSERT WITH CHECK (get_user_role() = 'admin');

CREATE POLICY routing_rules_update ON routing_rules
  FOR UPDATE USING (get_user_role() = 'admin');

CREATE POLICY routing_rules_delete ON routing_rules
  FOR DELETE USING (get_user_role() = 'admin');

-- ---------- custom_fields ----------

CREATE POLICY custom_fields_select ON custom_fields
  FOR SELECT USING (true);

CREATE POLICY custom_fields_insert ON custom_fields
  FOR INSERT WITH CHECK (get_user_role() = 'admin');

CREATE POLICY custom_fields_update ON custom_fields
  FOR UPDATE USING (get_user_role() = 'admin');

CREATE POLICY custom_fields_delete ON custom_fields
  FOR DELETE USING (get_user_role() = 'admin');

-- ---------- department_schedules ----------

CREATE POLICY department_schedules_select ON department_schedules
  FOR SELECT USING (true);

CREATE POLICY department_schedules_insert ON department_schedules
  FOR INSERT WITH CHECK (get_user_role() = 'admin');

CREATE POLICY department_schedules_update ON department_schedules
  FOR UPDATE USING (get_user_role() = 'admin');

CREATE POLICY department_schedules_delete ON department_schedules
  FOR DELETE USING (get_user_role() = 'admin');

-- ---------- department_categories ----------

CREATE POLICY department_categories_select ON department_categories
  FOR SELECT USING (true);

CREATE POLICY department_categories_insert ON department_categories
  FOR INSERT WITH CHECK (get_user_role() = 'admin');

CREATE POLICY department_categories_update ON department_categories
  FOR UPDATE USING (get_user_role() = 'admin');

CREATE POLICY department_categories_delete ON department_categories
  FOR DELETE USING (get_user_role() = 'admin');

-- ---------- branding_config ----------

CREATE POLICY branding_config_select ON branding_config
  FOR SELECT USING (true);

CREATE POLICY branding_config_insert ON branding_config
  FOR INSERT WITH CHECK (get_user_role() = 'admin');

CREATE POLICY branding_config_update ON branding_config
  FOR UPDATE USING (get_user_role() = 'admin');

CREATE POLICY branding_config_delete ON branding_config
  FOR DELETE USING (get_user_role() = 'admin');

-- ---------- branches ----------

CREATE POLICY branches_select ON branches
  FOR SELECT USING (true);

CREATE POLICY branches_insert ON branches
  FOR INSERT WITH CHECK (get_user_role() = 'admin');

CREATE POLICY branches_update ON branches
  FOR UPDATE USING (get_user_role() = 'admin');

CREATE POLICY branches_delete ON branches
  FOR DELETE USING (get_user_role() = 'admin');

-- ---------- regions ----------

CREATE POLICY regions_select ON regions
  FOR SELECT USING (true);

CREATE POLICY regions_insert ON regions
  FOR INSERT WITH CHECK (get_user_role() = 'admin');

CREATE POLICY regions_update ON regions
  FOR UPDATE USING (get_user_role() = 'admin');

CREATE POLICY regions_delete ON regions
  FOR DELETE USING (get_user_role() = 'admin');

-- ---------- teams ----------

CREATE POLICY teams_select ON teams
  FOR SELECT USING (true);

CREATE POLICY teams_insert ON teams
  FOR INSERT WITH CHECK (get_user_role() = 'admin');

CREATE POLICY teams_update ON teams
  FOR UPDATE USING (get_user_role() = 'admin');

CREATE POLICY teams_delete ON teams
  FOR DELETE USING (get_user_role() = 'admin');


-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
