-- ============================================================================
-- 014_perf_indexes.sql
-- ============================================================================
-- Indexes recommended by Supabase's index advisor against live query stats
-- after the SLA work landed. The dashboard's `useTickets()` fetch was the
-- hot path: planner cost dropped from 2306 → 413 (~5.5x) when the three
-- ticket-related indexes (created_at + the two FK columns) were applied.
-- The remaining indexes cover ORDER BY columns on small admin tables
-- (department_categories, department_schedules, sla_policies, view_configs,
-- profiles) — each individually small but they're called on every page
-- load and add up.
--
-- All `IF NOT EXISTS` so re-running is a no-op. None of these are
-- partial / expression indexes — straight btree on the column.
-- ============================================================================

-- Tickets: ORDER BY created_at DESC on the dashboard list.
CREATE INDEX IF NOT EXISTS idx_tickets_created_at
    ON public.tickets (created_at);

-- ticket_cc / ticket_collaborators: lateral subquery joins by ticket_id.
CREATE INDEX IF NOT EXISTS idx_ticket_cc_ticket_id
    ON public.ticket_cc (ticket_id);

CREATE INDEX IF NOT EXISTS idx_ticket_collaborators_ticket_id
    ON public.ticket_collaborators (ticket_id);

-- Profiles: ORDER BY name ASC on the user-list query.
CREATE INDEX IF NOT EXISTS idx_profiles_name
    ON public.profiles (name);

-- view_configs: ORDER BY sort_order on every list view.
CREATE INDEX IF NOT EXISTS idx_view_configs_sort_order
    ON public.view_configs (sort_order);

-- department_categories: ORDER BY ticket_type, sort_order on category fetch.
CREATE INDEX IF NOT EXISTS idx_department_categories_ticket_type
    ON public.department_categories (ticket_type);

-- department_schedules: ORDER BY department_name on the schedules admin page.
CREATE INDEX IF NOT EXISTS idx_department_schedules_department_name
    ON public.department_schedules (department_name);

-- sla_policies: ORDER BY sort_order on the SLA admin page and resolver.
CREATE INDEX IF NOT EXISTS idx_sla_policies_sort_order
    ON public.sla_policies (sort_order);
