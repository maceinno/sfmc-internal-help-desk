---
name: reply-attachment-silent-drop
status: fixed
created: 2026-05-05T16:35:19Z
updated: 2026-05-06T15:30:00Z
source: Slack report, ticket T-1236, 2026-05-05
---

> **Status update 2026-05-06:** the clean fix (direct-to-Supabase
> signed uploads) shipped. `/api/upload/sign` mints a one-time signed
> URL + creates a `pending` attachments row; the browser PUTs the file
> straight to Supabase Storage; `/api/upload/finalize` flips the row
> to `ready`. The Vercel ~4.5 MB body limit no longer applies — cap
> is now the bucket's 50 MB. Legacy `/api/upload` stays as deprecated
> fallback until callers fully migrate.

# Reply attachments silently dropped when files exceed Vercel body limit (~4.5 MB)

## Symptom

Agent attached 4 files (5–9 MB each) to a follow-up reply on T-1236. The
reply text posted, but only the original first-message attachment (176 KB
xlsx) renders in the Attachments panel afterwards. No error toast, no
indication anything went wrong.

## Root cause — two compounding bugs

**1. Vercel function body limit silently rejects large uploads.**

The composer advertises `Max file size: 20 MB` and
`src/app/api/upload/route.ts:11` enforces 20 MB at the route level:

```ts
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
```

But Vercel's default serverless function body limit is ~4.5 MB.
`vercel.json` and `next.config.ts` don't override it. Any file >4.5 MB
gets a 413 from the platform before our route handler runs. Files in the
T-1236 reply: 6185, 9800, 5049, 6317 KB — all over the platform limit.
The original `Parham Income.xlsx` that *did* succeed was 176 KB.

**2. Page handler swallows upload failures.**

`src/app/(portal)/tickets/[id]/page.tsx:372-376`:

```ts
if (uploadRes.ok) {
  const uploadData = await uploadRes.json()
  if (uploadData.id) attachmentIds.push(uploadData.id)
}
// no else branch — failed uploads are dropped on the floor
```

When uploads 413, the loop continues, `attachmentIds` ends up empty,
and the reply is POSTed with `attachmentIds: undefined`. The message
row persists fine (which is why the new comment text shows up) but no
attachment rows are linked → only the first-message attachment renders.

## What the user experiences

1. Drag in 4 files (5–9 MB each) — UI accepts (no real-platform-limit check)
2. Click Send → each `/api/upload` POST 413s
3. No toast, no error
4. Thread re-renders showing the new comment text; Attachments panel
   still shows only the original 176 KB xlsx

## Fix shape

**Clean fix:** direct-to-Supabase uploads via signed upload URLs.
`/api/upload/sign` returns a signed URL + attachment row; client PUTs
the file straight to Supabase Storage. Bypasses Vercel's body limit
entirely; cap becomes whatever the bucket allows.

**Cheaper interim:**
- Surface upload failures in `handleReplySubmit` — toast and abort, or
  post the reply with a "couldn't attach: X, Y" warning so the user
  isn't left guessing.
- Pre-check file sizes in the composer against the real platform limit
  (~4.5 MB) so the UI's "20 MB" promise stops lying.

## Repro

1. Open any ticket
2. Compose a reply and attach a file >5 MB
3. Click Send
4. Reply posts but attachment is missing from the thread; no error shown

## Notes

- Tried to file as a GitHub issue on `maceinno/sfmc-internal-help-desk`
  but the local `gh` PAT is rejected by org policy (token lifetime
  >366 days). When the token is refreshed, this can be promoted to an
  issue verbatim.
