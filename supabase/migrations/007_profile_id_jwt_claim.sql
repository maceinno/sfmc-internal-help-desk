-- ============================================================================
-- 007_profile_id_jwt_claim.sql
--
-- Switch RLS helpers from `auth.jwt() ->> 'sub'` to a custom `profile_id`
-- claim, with a coalesce fallback to `sub` so we can apply this migration
-- BEFORE the new JWT template is rolled out without breaking current
-- sessions.
--
-- Background: when migrating Clerk dev → prod, we re-create users in
-- prod with `external_id = <legacy_dev_clerk_id>`. We can't override the
-- standard `sub` claim in either Clerk's session token customizer or its
-- named JWT templates (both treat `sub` as reserved). The workaround is
-- to surface the legacy/effective profile id via a custom claim:
--
--   {"profile_id": "{{user.external_id || user.id}}", ...}
--
-- in the supabase JWT template, and have RLS read `profile_id` instead
-- of `sub`.
--
-- Order of operations:
--   1. Apply this migration (safe — coalesce falls back to `sub` while
--      `profile_id` is absent, so existing sessions keep working).
--   2. Update the supabase JWT template in Clerk to add the `profile_id`
--      claim.
--   3. After the dev → prod cutover and verification, the `sub`
--      fallback can be removed in a follow-up migration.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_current_user_id() RETURNS text AS $$
  SELECT coalesce(auth.jwt() ->> 'profile_id', auth.jwt() ->> 'sub')
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION get_user_role() RETURNS text AS $$
  SELECT role FROM profiles
   WHERE id = coalesce(auth.jwt() ->> 'profile_id', auth.jwt() ->> 'sub')
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_user_team_ids() RETURNS text[] AS $$
  SELECT team_ids FROM profiles
   WHERE id = coalesce(auth.jwt() ->> 'profile_id', auth.jwt() ->> 'sub')
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_user_branch_id() RETURNS uuid AS $$
  SELECT managed_branch_id FROM profiles
   WHERE id = coalesce(auth.jwt() ->> 'profile_id', auth.jwt() ->> 'sub')
     AND has_branch_access = true
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_user_region_id() RETURNS uuid AS $$
  SELECT managed_region_id FROM profiles
   WHERE id = coalesce(auth.jwt() ->> 'profile_id', auth.jwt() ->> 'sub')
     AND has_regional_access = true
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- The three IS NOT NULL checks elsewhere in the policies (insert/update
-- guards) are left on `auth.jwt() ->> 'sub'` — those are auth-presence
-- checks and `sub` is always present in any Clerk-issued JWT. They're
-- not user-identity lookups and don't need to change.
