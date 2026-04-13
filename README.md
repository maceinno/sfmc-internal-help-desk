# SFMC Internal Help Desk

Internal help desk portal for SFMC Home Lending, replacing Zendesk with a custom-built solution tailored to the organization's ticket management workflow.

## Tech Stack

- **Framework:** Next.js 15 (App Router) with TypeScript
- **Database:** Supabase (PostgreSQL + Row-Level Security + Realtime + Storage)
- **Authentication:** Clerk (email/password, SSO-ready)
- **Hosting:** Vercel
- **Server State:** TanStack Query
- **Client State:** Zustand
- **Forms:** React Hook Form + Zod validation
- **UI:** shadcn/ui + Tailwind CSS v4 + Lucide icons
- **Charts:** Recharts
- **Testing:** Vitest + Testing Library

## Key Features

- **Ticket Management** -- Create, assign, reply, merge, and track tickets with T-XXXX formatted IDs
- **Role-Based Access** -- Three roles (admin, agent, employee) with middleware-enforced route protection
- **SLA Monitoring** -- Automated SLA breach detection via Vercel Cron (every 5 minutes), business hours calculations, and at-risk dashboards
- **Real-Time Updates** -- Supabase Realtime subscriptions for live ticket updates
- **Multi-View Tickets** -- My tickets, CC'd tickets, branch-level, and region-level views
- **Admin Panel** -- Categories, custom fields, canned responses, routing rules, SLA policies, schedules, branding, user management, saved views, and bulk import
- **File Attachments** -- Upload and manage ticket attachments via Supabase Storage
- **Auto-Assignment** -- Rule-based ticket routing engine
- **Notifications** -- Real-time notification panel
- **Reports** -- Analytics and reporting dashboard with Recharts visualizations
- **Clerk Webhook Sync** -- Automatic user sync from Clerk to Supabase via webhooks

## Prerequisites

- Node.js 20.x or later
- npm
- A [Supabase](https://supabase.com) project (or local instance via `supabase start`)
- A [Clerk](https://clerk.com) application

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/maceinno/sfmc-internal-help-desk.git
cd sfmc-internal-help-desk
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and fill in your Clerk and Supabase credentials:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` -- Clerk publishable key
- `CLERK_SECRET_KEY` -- Clerk secret key
- `NEXT_PUBLIC_SUPABASE_URL` -- Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` -- Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` -- Supabase service role key
- `CLERK_WEBHOOK_SECRET` -- Webhook secret for Clerk user sync

### 4. Set up the database

Run the migration files in order against your Supabase project:

1. `supabase/migrations/001_initial_schema.sql` -- Creates 20 tables
2. `supabase/migrations/002_rls_policies.sql` -- Row-level security policies
3. `supabase/migrations/003_seed_data.sql` -- Development seed data

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
  app/            Next.js App Router (auth pages, portal pages, API routes)
  components/     React components organized by feature
  hooks/          TanStack Query hooks for data fetching
  lib/            Business logic (Supabase clients, permissions, SLA, routing)
  stores/         Zustand stores for client-side UI state
  types/          TypeScript type definitions
  middleware.ts   Clerk auth + role-based route protection
supabase/
  migrations/     Database schema, RLS policies, and seed data
tests/
  unit/           Unit tests (SLA calculator, permissions)
  integration/    Integration tests
  e2e/            End-to-end tests
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npx tsc --noEmit` | Type check |
| `npx vitest run` | Run tests |

## CI/CD

- **GitHub Actions** runs lint, type-check, tests, and build on every push/PR to `main`
- **Vercel** auto-deploys from the `main` branch with preview deploys on PRs
- **SLA Cron** runs every 5 minutes via Vercel Cron (configured in `vercel.json`)

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Ensure `npm run lint`, `npx tsc --noEmit`, and `npx vitest run` all pass
4. Open a pull request -- CI will run automatically
