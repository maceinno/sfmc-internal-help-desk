-- 015_profiles_is_active.sql
-- ---------------------------------------------------------------------------
-- User deactivation flag.
--
-- Deactivated users are HARD-BLOCKED: banned in Clerk (sessions revoked,
-- sign-in refused) and bounced by middleware. They are excluded from ticket
-- auto-routing, assignment pickers, and team-queue email fan-out. Their
-- ticket history is preserved — deactivate is NOT delete.
--
-- Forward-only. Default true so every existing user stays active.
-- ---------------------------------------------------------------------------

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- The deactivated set is small; the common reads are "exclude inactive" and
-- "list the inactive ones", so a partial index on the false rows is cheapest.
CREATE INDEX IF NOT EXISTS idx_profiles_inactive
  ON profiles (id)
  WHERE is_active = false;
