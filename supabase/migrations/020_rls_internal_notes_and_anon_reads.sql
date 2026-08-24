-- ============================================================================
-- 020 — Close two RLS holes: internal notes, and anon-key reads
-- ============================================================================
--
-- Found 2026-08-24 while deriving the generic help-desk starter from this
-- schema. Both are live and both are readable with nothing but the anon key,
-- which ships to every browser.
--
-- HOLE 1 — internal notes are not internal.
--   `messages_select` was `USING (can_see_ticket(ticket_id))` and never looked
--   at `is_internal`. Hiding internal notes is done in the APP layer only
--   (canViewInternalNotes(), policies.ts:232), so an employee who can see a
--   ticket — its requester, a CC, a collaborator — could read every agent-only
--   note on it straight from PostgREST with the anon key and their own JWT.
--   No exploit needed beyond opening devtools.
--
-- HOLE 2 — every policy is TO PUBLIC, and profiles_select is USING (true).
--   Not one policy in 002 carries a TO clause, so all of them apply to `anon`
--   as well as `authenticated`. Combined with `USING (true)` on profiles and on
--   the eleven config tables, the anon key alone reads every user's name, email
--   and role, plus the whole org's teams, categories, SLA policies and routing.
--
-- WHY THIS USES `get_current_user_id() IS NOT NULL` AND NOT `TO authenticated`
--   `TO authenticated` is the textbook fix and it is the one thing that could
--   break every signed-in user here. The Postgres role a request runs as comes
--   from the `role` claim in the Clerk-minted JWT, which is configured in the
--   Clerk dashboard's `supabase` JWT template — outside this repo, unversioned,
--   and not verifiable from here. If that template does not emit
--   `"role": "authenticated"`, every logged-in request arrives as `anon` and a
--   TO-clause change would take the whole app down at once.
--
--   Predicating on the CLAIM instead is equivalent in security terms and holds
--   whichever Postgres role the JWT maps to: `get_current_user_id()` reads
--   coalesce(jwt->>'profile_id', jwt->>'sub'), and the bare anon key carries
--   neither. Tightening the TO clause is still worth doing later, but it should
--   be its own change, after someone has read the JWT template and confirmed
--   the role claim.
--
-- WHY `ALTER POLICY` AND NOT DROP + CREATE
--   ALTER POLICY changes the predicate in place. A DROP leaves the table with
--   one fewer policy until the CREATE lands, and on a table whose remaining
--   policies are permissive that window is an outage or an exposure depending
--   on which way it falls. There is also no window where a failed migration
--   leaves the table with no SELECT policy at all.
--
-- SAFETY CHECKED BEFORE WRITING THIS:
--   - `createSupabaseClient()` (the bare anon client) is exported from
--     src/lib/supabase/index.ts but has NO callers anywhere in src/.
--   - `useBranding()` is only read from inside the (portal) route group and
--     admin/branding — both authenticated. Nothing renders branding on the
--     sign-in page, so restricting branding_config does not affect signed-out
--     users. If a branded sign-in page is ever wanted, branding_config is the
--     one table below that would need to go back to public read.
--   - Service-role callers (webhooks, the SLA cron, upload finalize) bypass RLS
--     entirely and are unaffected.
-- ============================================================================

-- ── Hole 1: internal notes ──────────────────────────────────────────────────
-- Mirrors canViewInternalNotes() exactly: admins and agents only. The database
-- is now the authority and the app-layer check is defence in depth rather than
-- the only thing standing between an employee and their agents' notes.
ALTER POLICY messages_select ON public.messages
  USING (
    can_see_ticket(ticket_id)
    AND (
      is_internal = false
      OR get_user_role() IN ('admin', 'agent')
    )
  );

-- ── Hole 2a: profiles ───────────────────────────────────────────────────────
-- Still readable by any signed-in user — the app genuinely needs the directory
-- for assignee pickers, CC autocomplete and @-mentions. It is no longer
-- readable by someone holding only the anon key.
ALTER POLICY profiles_select ON public.profiles
  USING (get_current_user_id() IS NOT NULL);

-- ── Hole 2b: the eleven config tables ───────────────────────────────────────
-- All were USING (true). Same reasoning: signed-in users need them, the
-- anonymous internet does not.
ALTER POLICY sla_policies_select         ON public.sla_policies         USING (get_current_user_id() IS NOT NULL);
ALTER POLICY view_configs_select         ON public.view_configs         USING (get_current_user_id() IS NOT NULL);
ALTER POLICY canned_responses_select     ON public.canned_responses     USING (get_current_user_id() IS NOT NULL);
ALTER POLICY routing_rules_select        ON public.routing_rules        USING (get_current_user_id() IS NOT NULL);
ALTER POLICY custom_fields_select        ON public.custom_fields        USING (get_current_user_id() IS NOT NULL);
ALTER POLICY department_schedules_select ON public.department_schedules USING (get_current_user_id() IS NOT NULL);
ALTER POLICY department_categories_select ON public.department_categories USING (get_current_user_id() IS NOT NULL);
ALTER POLICY branding_config_select      ON public.branding_config      USING (get_current_user_id() IS NOT NULL);
ALTER POLICY branches_select             ON public.branches             USING (get_current_user_id() IS NOT NULL);
ALTER POLICY regions_select              ON public.regions              USING (get_current_user_id() IS NOT NULL);
ALTER POLICY teams_select                ON public.teams                USING (get_current_user_id() IS NOT NULL);

-- ============================================================================
-- VERIFY AFTER APPLYING
-- ============================================================================
-- 1. No SELECT policy is unconditionally true any more. Expect ZERO rows:
--
--      select tablename, policyname, qual
--        from pg_policies
--       where schemaname = 'public' and cmd = 'SELECT' and qual = 'true';
--
-- 2. Internal notes are gated. Expect the is_internal clause to be present:
--
--      select qual from pg_policies
--       where schemaname = 'public' and policyname = 'messages_select';
--
-- 3. THE ONE THAT MATTERS — prove it from outside, with the anon key. This must
--    come back as an empty array, and it must be run against the real project
--    URL rather than assumed. A 401/403 body also reads as "[]" to a careless
--    eye, so check the STATUS as well:
--
--      curl -s -o /dev/null -w '%{http_code}\n' \
--        -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
--        "$SUPABASE_URL/rest/v1/profiles?select=email&limit=1"
--
--    Before this migration that returns 200 with real email addresses in the
--    body. After it, the row set is empty. Run the same probe against a table
--    you know is readable to confirm the query itself works — an empty table
--    and a broken query look identical.
--
-- 4. Then sign in as an EMPLOYEE (not an agent) and open a ticket that has an
--    internal note on it. The note must not appear, and the network tab must
--    not contain it either — the app hid it before; the point of this change is
--    that the payload no longer carries it.
-- ============================================================================
