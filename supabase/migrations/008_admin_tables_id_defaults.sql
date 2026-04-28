-- ============================================================================
-- 008_admin_tables_id_defaults.sql
--
-- The text-PK admin tables (canned_responses, routing_rules, sla_policies,
-- teams, view_configs) had NO default on their `id` column, so any client
-- INSERT that omitted id failed with a not-null constraint violation. The
-- seed data (`003_seed_data.sql`) supplied IDs manually (`cr1`, `cr2`, …),
-- which masked the issue until an admin tried to create a new row from
-- the UI ("nothing happens" / silent fail).
--
-- Fix: stamp every new row's id with `gen_random_uuid()::text`. The
-- column stays `text` so existing seed rows (and any external references)
-- remain valid; only inserts that omit id pick up the new default.
-- ============================================================================

ALTER TABLE canned_responses
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

ALTER TABLE routing_rules
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

ALTER TABLE sla_policies
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

ALTER TABLE teams
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

ALTER TABLE view_configs
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
