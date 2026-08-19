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
