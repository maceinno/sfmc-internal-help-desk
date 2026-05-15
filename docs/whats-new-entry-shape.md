# /whats-new entry shape

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

## Rules

- **Date** is the day the change reached prod, not the day you author
  the entry. Backfill if you're catching up.
- **howToTest** is the user-facing test recipe, role by role. Skip a
  role if it can't observe the change. Write it the way you'd brief a
  non-technical user — no jargon, no internal terminology.
- **Never** link to PRs, commits, or internal jargon (RLS, Supabase,
  PostgREST, Edge Function, etc.) from a `/whats-new` entry. That's
  for the changelog. `/whats-new` is for end users.
- **Title** is one line of plain English. No ticket numbers, no
  bracketed prefixes.
- **Summary** is 1–3 sentences explaining what changed from the
  user's point of view. Not what code changed — what behavior
  changed.

## Roles

The role keys in `howToTest` correspond to the app's role model:

- `creator` — the user who created the ticket
- `cc` — anyone CC'd on the ticket
- `assignee` — the user the ticket is assigned to
- `branch-manager` — branch-level manager role
- `regional-manager` — regional manager role
- `admin` — admin / superuser role

If a role can't observe the change at all, omit that key — don't fill
it with "no change visible" filler.

## Example

```ts
{
  date: '2026-05-15',
  title: 'CC users can now reply from the ticket page',
  summary: 'Previously only the creator and assignee could post replies. CC users can now reply too, and their replies are clearly marked as coming from a CC participant.',
  howToTest: {
    creator: 'Open a ticket where you added someone as CC. Ask them to reply. You should see their reply in the thread with a "CC" badge.',
    cc: 'Open a ticket you were CC\'d on. You should now see a reply box at the bottom. Post a reply — it should appear with your name and a "CC" badge.',
    assignee: 'Open a ticket that has CC users. Watch for their replies in the thread — they\'ll be marked with a "CC" badge so you can tell them apart from the creator.',
  }
}
```
