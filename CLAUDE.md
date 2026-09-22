# SFMC Internal Help Desk

## Overview
Internal help desk portal replacing Zendesk for SFMC Home Lending. Built with Next.js 15 (App Router).

## Tech Stack
- Framework: Next.js 15 (App Router) with TypeScript
- Database: Supabase (PostgreSQL + RLS + Realtime + Storage)
- Auth: Clerk (email/password, SSO-ready)
- Hosting: Vercel
- State: TanStack Query (server) + Zustand (client UI)
- Forms: React Hook Form + Zod
- UI: shadcn/ui + Tailwind CSS v4 + Lucide icons
- Charts: Recharts
- Testing: Vitest + Testing Library

## Project Structure
```
src/
  app/                    # Next.js App Router
    (auth)/               # Auth pages (sign-in, sign-up) via Clerk
    (portal)/             # Main app behind auth
      admin/              # Admin settings (branding, categories, canned-responses,
                          #   custom-fields, import, routing, schedules, sla, users, views)
      dashboard/          # Agent/admin dashboard with stats and SLA monitoring
      tickets/            # Ticket list, detail [id], and new ticket form
      my-tickets/         # Employee's own tickets
      cc-tickets/         # Tickets where user is CC'd
      branch/             # Branch-level ticket view
      region/             # Region-level ticket view
      reports/            # Reporting and analytics
    api/                  # API routes
      tickets/            # CRUD + [id]/reply, [id]/merge
      sla/check/          # SLA breach check (Vercel Cron, every 5 min)
      upload/             # File upload to Supabase Storage
      import/             # Bulk import (tickets, users)
      users/ooo/          # Out-of-office status
      webhooks/clerk/     # Clerk webhook for user sync
  components/
    ui/                   # shadcn/ui primitives (button, card, dialog, table, etc.)
    layout/               # Sidebar, notification panel, realtime provider
    tickets/              # Ticket list, table, filters, badges
    ticket-detail/        # Message thread, reply composer, merge modal, attachments
    create-ticket/        # Ticket creation form + custom field renderer
    dashboard/            # Stats cards, SLA at-risk table
    shared/               # Canned response picker, file upload, user autocomplete
    admin/                # Admin config components (placeholder)
    reports/              # Report components (placeholder)
  hooks/                  # TanStack Query hooks for data fetching
    use-tickets.ts        # Ticket CRUD queries/mutations
    use-current-user.ts   # Current user profile + role
    use-users.ts          # User list queries
    use-notifications.ts  # Notification queries
    use-realtime-tickets.ts # Supabase Realtime subscription
    use-admin-config.ts   # Admin configuration queries
  lib/
    supabase/             # Supabase clients (client, server, admin)
    permissions/          # Role-based permission checks (policies.ts)
    sla/                  # SLA calculator, business hours, policy matcher
    routing/              # Auto-assignment rule engine
    db/                   # DB queries and mutations (placeholder dirs)
    clerk/                # Clerk utilities (placeholder)
    utils.ts              # Shared utility functions (cn, etc.)
  stores/                 # Zustand stores for client-side UI state
    ui-store.ts           # UI state (sidebar, modals)
    notification-store.ts # Notification state
  types/                  # TypeScript type definitions
    index.ts              # Shared types
    ticket.ts             # Ticket-related types
  data/                   # Static config / seed helpers
    ticket-config.ts      # Ticket configuration constants
  middleware.ts           # Clerk auth middleware with role-based route protection
supabase/
  migrations/
    001_initial_schema.sql  # 20 tables (tickets, users, categories, SLA, etc.)
    002_rls_policies.sql    # Row-level security policies
    003_seed_data.sql       # Seed data for development
tests/
  unit/                   # Unit tests
    sla/calculator.test.ts
    permissions/policies.test.ts
  integration/            # Integration tests (placeholder)
  e2e/                    # End-to-end tests (placeholder)
  setup.ts                # Test setup file
```

## Key Patterns
- Server Components for layouts/pages, Client Components for interactive UI
- Supabase RLS with Clerk JWTs for row-level security
- TanStack Query hooks in `src/hooks/` for all data fetching
- Zustand stores in `src/stores/` for UI-only state (sidebar, notifications)
- Permission checks via `src/lib/permissions/policies.ts`
- SLA calculations via `src/lib/sla/` (business hours, policy matching, breach detection)
- Auto-assignment via `src/lib/routing/rule-engine.ts`
- Clerk middleware in `src/middleware.ts` enforces role-based route access
- Three user roles: admin, agent, employee
- Route groups: `(auth)` for sign-in/up, `(portal)` for authenticated app

## Database
- 20 tables defined in `supabase/migrations/001_initial_schema.sql`
- RLS policies in `002_rls_policies.sql`
- Seed data in `003_seed_data.sql`
- Ticket IDs use T-XXXX format via PostgreSQL sequence

## Environment Variables
See `.env.local.example` for required variables:
- Clerk: publishable key, secret key, sign-in/sign-up URLs
- Supabase: URL, anon key, service role key
- Clerk webhook secret for user sync

## Running Locally
1. Copy `.env.local.example` to `.env.local` and fill in values
2. `npm install`
3. `npm run dev`

## Testing
- `npx vitest run` — run all tests
- Tests in `tests/unit/` and `tests/integration/`
- Vitest config: `vitest.config.mts`
- Component tests use jsdom, unit tests use node environment

## CI/CD
- GitHub Actions: `.github/workflows/ci.yml` (lint, type-check, test, build)
- Vercel auto-deploys from main branch
- Preview deploys on PRs
- SLA cron runs every 5 minutes via Vercel Cron (`vercel.json`)

## Useful Commands
- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run lint` — ESLint
- `npx tsc --noEmit` — type check
- `npx vitest run` — run tests

## Admin surfaces that hold MANY integrations — design standard

Products accumulate integrations (messaging, AI, credit, title, LOS, email,
property data). The admin screen that configures them is what reliably rots,
because each new one is added the cheapest way: append another section to the
page that already exists. One Mace client's integrations page reached **1808
lines and 14 stacked accordions with a search filter added just to cope with its
own length** — every commit locally reasonable, the result unusable.

Build it right the first time:

1. **Registry-driven, not layout surgery.** A new integration is a DATA entry
   (key, label, group, status, fields) rendered by a generic list + detail view.
   If adding one means writing JSX in a page component, the design is wrong.
2. **Group by PURPOSE behind tabs or a sub-nav** — Messaging · AI · Data
   providers · Email · Tooling · Logs · Compliance. Render only the active
   group, and keep it deep-linkable (`?section=…`) so links survive.
3. **Status at a glance** — configured / connected / error, visible WITHOUT
   expanding anything. "What is broken right now?" is the page's first job.
4. **One component file per section.** The page composes; it does not implement.
5. **Only integrations belong there.** Logs, consent/compliance registers, test
   benches and intake config get their own home.
6. **THE TRIGGER — restructure BEFORE adding.** Past ~8 sections or ~500 lines,
   the next integration does not get appended: restructure first, and say so
   plainly. The cost is small at 8 sections and brutal at 14.
7. **Never trade functionality for tidiness.** Every control that worked before
   works after; if something looks removable, ask.

Full rule: `mace-tech/.claude/rules/integration-admin-ui.md`.

### Applies GOING FORWARD — existing code is grandfathered

This standard governs **new** work. It is explicitly **not** a mandate to
refactor what already ships here.

- **Do NOT rewrite existing admin sections, integrations or pages to comply.**
  Working code that predates this standard stays as-is. Legacy smell is
  accepted debt, not a bug to fix on sight.
- **New** integrations, new admin sections and substantial rewrites of an
  existing section DO follow it.
- If you are extending a legacy area and the standard would force a large
  refactor, keep the change small and in the local style, then say once that
  the area is a candidate for restructuring. Do not restructure unasked.
- A restructure happens only when the operator asks for it, or when the
  section you were told to change is already past the trigger and adding to it
  would make things materially worse — in which case say so and get agreement
  BEFORE starting.

The point is to stop the next 1808-line page from forming, not to churn the
ones that already exist.

## This is no longer a small dataset — size every list for it

**MEASURED 2026-09-08** from a Jerry sandbox, by querying the preview Supabase
project directly with the service-role client (`node --env-file=.env.local`,
`@supabase/supabase-js`) and by timing/sizing the exact projection
`useTickets()` sends:

| Measure | Value |
| --- | --- |
| `tickets` rows | 4,189 |
| `messages` rows | 20,904 |
| `attachments` rows | 3,081 |
| `profiles` rows | 180 |
| `view_configs` rows (all enabled) | 66 |
| One `useTickets()` payload | **8.1 MB of JSON, ~1.4 s server time** |
| Of which: embedded `messages` | 4.09 MB |
| Of which: `description` | 1.07 MB |

These are preview-database numbers. Production volume is **not** measurable
from a Jerry sandbox — Mace can measure it — but preview is loaded from the
same Zendesk import, so treat production as the same order of magnitude.

### What follows from that

1. **`useTickets()` is the heaviest thing the app does, and every portal
   screen calls it** — dashboard, reports, my-tickets, cc-tickets, branch,
   region, the tickets layout and ticket detail. It is one shared cache entry
   (all callers pass no filters), so treat it as an app-wide cost, not a
   per-page one. It is deliberately given a 5-minute `staleTime` and
   `refetchOnWindowFocus: false`; Realtime supplies liveness.
2. **Never render a whole ticket collection.** Page it (`lib/pagination/
   paginate.ts` + `components/shared/pager.tsx`, 50/page) or cap it with a
   "show more" (see `ticket-queue-list.tsx`). Before this change the agent
   list drew all 4,189 rows × 9 columns — ~37,700 cells with an SLA countdown
   recomputed per row — which froze the browser tab on every screen.
3. **Realtime `tickets` events are throttled** (`lib/realtime/throttle.ts`,
   10 s, leading edge immediate) because each one used to make every open
   browser re-download those 8.1 MB. Invalidate `ticketKeys.lists()`, never
   the whole `['tickets']` prefix — that also discards open ticket details and
   in-flight reply searches. The user's own mutations still invalidate
   directly and immediately; do not route those through the throttle.
4. **Filter and search on the server where you can.** Reply bodies already
   are (`/api/tickets/search-replies`). Ticket `description` is still shipped
   to the browser purely so a 1–2 character search can match it locally;
   moving that server-side is the next 1 MB, and is *unmeasured* as to
   whether it changes search behaviour anyone relies on — ask before doing it.
5. **Resetting page state belongs in derived state, not a `useEffect`.** The
   tickets layout has already produced one "Maximum update depth exceeded"
   crash from setState-inside-effect (see `lib/views/department-views.ts`).
   Both new list components key their paging off a filter signature computed
   during render, which cannot loop.

## Realtime does not reach the browser — do not rely on it for liveness

**MEASURED 2026-09-22** from a Jerry sandbox against the **preview** Supabase
project, using this repo's own `@supabase/supabase-js` (`node
--env-file=.env.local`). Each probe subscribed to `postgres_changes` on
`tickets`, then a service-role write touched one ticket's `updated_at`:

| Socket opened as | `subscribe()` reported | Events in 8 s |
| --- | --- | --- |
| service-role key | `SUBSCRIBED` | **1** (`UPDATE`) |
| anon key + Clerk JWT in `global.headers` (what the app does) | `SUBSCRIBED` | **0** |
| anon key + `realtime.setAuth(<service JWT>)` | `SUBSCRIBED` | **0** |
| anon key + `accessToken` option | `SUBSCRIBED` | **0** |

So replication for `tickets` **is** enabled and the database end works; a
browser-shaped connection reports a healthy channel and receives nothing.

**NOT measured, and it matters:** a real Clerk *user* JWT cannot be minted in
a Jerry sandbox, so the exact browser case is inferred from the anon probes
rather than observed. Mace can measure it properly. Treat the row above as
"an anon-key socket gets nothing", not as a proven statement about every
signed-in user.

Two things follow:

1. **`use-realtime-tickets` is best-effort, not the refresh mechanism.** It
   now calls `realtime.setAuth()` with the Clerk token and re-mints it every
   45 s (Clerk tokens are ~60 s), because the socket previously carried no
   identity at all. That is a defect removed, **not** a verified fix.
2. **`use-ticket-freshness` is what actually keeps screens current.** It
   polls one row — the newest `updated_at` the signed-in user may see — every
   30 s and on window focus, and invalidates `ticketKeys.lists()` +
   `ticketKeys.details()` only when that value moves. Measured cost of the
   probe: **65 bytes, ~270–470 ms warm**, versus 8.1 MB / ~1.4 s for the list
   it guards. Do not replace it with a plain `refetchInterval` on
   `useTickets()`.

### Status on reply — the rule lives in one file

`src/lib/tickets/reply-status.ts` holds both halves (`replyStatusForRole` for
what a reply carries, `shouldAutoReopen` for what the API does with it). The
composer and `POST /api/tickets/[id]/reply` both import it; they used to
state the rule separately and drifted.

- **Employees have no status control.** Their reply carries no status. Before
  2026-09-22 they were shown the full agent dropdown, which defaults to
  "Submit as Open" on a new ticket — so a requester's own follow-up moved
  their ticket out of New. That was the reported "tickets come over as open
  instead of new".
- **`new` is not an agent-waiting status.** A reply never moves a ticket out
  of New; `solved` / `pending` / `on_hold` reopen.
- **"Send and keep it solved"** (`keepStatus: true`) is the only way a
  requester can decline the reopen.
