# CLAUDE.md

Project-level guidance for Claude working in `sfmc-internal-help-desk`.

## /whats-new entries

Every user-visible change MUST add a `/whats-new` entry. Shape (as of
2026-05-15):

```ts
{
  date: 'YYYY-MM-DD',           // day it reached prod, not today's date
  title: 'one line, plain English',
  summary: 'what changed, 1-3 sentences, no jargon',
  howToTest: {                  // per-role, user-language, optional
    creator?: string,
    cc?: string,
    assignee?: string,
    'branch-manager'?: string,
    'regional-manager'?: string,
    admin?: string,
  }
}
```

- **Date** is the day the change reached prod, not the day you author
  the entry. Backfill if you're catching up.
- **howToTest** is the user-facing test recipe, role by role. Skip a
  role if it can't observe the change. Write it the way you'd brief a
  non-technical user.
- **Never** link to PRs, commits, or internal jargon (RLS, Supabase,
  PostgREST, Edge Function, etc.) from a `/whats-new` entry. That's
  for the changelog. `/whats-new` is for end users.

Full authoring guide with role definitions and an example:
[`docs/whats-new-entry-shape.md`](docs/whats-new-entry-shape.md).
