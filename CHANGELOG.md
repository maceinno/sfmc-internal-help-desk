# Changelog

User-facing record of fixes and improvements to the SFMC Internal Help Desk.
Keep entries short and plain-English — employees should be able to read this.
Newest entries go on top.

This file mirrors the data rendered in-app at **/whats-new**
(source: `src/data/changelog.ts`). When you add a fix, update both files.

## 2026-04-28

### Reply composer

- **Submit-as status picker works again.** Picking a different status from the small caret menu next to the Submit button (Open / Pending / On Hold / Solved / Send-no-status-change) now actually changes the button label and submits with that status. Was silently doing nothing — particularly noticeable on Solved tickets where you wanted to reply and reopen as Pending or Open.
- **Click anywhere in the reply box to start typing.** The cursor lands on the first click no matter where in the reply area you click. Previously the placeholder showed mid-way down the box and only a small region was actually focusable.
- **Progress indicator while a reply is sending.** A thin animated bar runs across the top of the reply box while a reply is posting (blue for replies, amber for internal notes), in addition to the existing "Sending..." button label.

## 2026-04-27

### Ticket replies

- **Changing status from the right-hand panel now sends your typed reply too.** If you've typed a reply (or internal note) in the composer and then click a status — Solved, Pending, Open, etc. — in the Ticket Details panel, the reply posts along with the status change as one action. Works for internal notes too: typed note + status change saves both. The Submit-as-&lt;status&gt; split button on the composer still works exactly as before.

### Ticket detail

- **Assignee dropdown only shows agents who handle this department.** Admins plus any agent whose department list includes the ticket's department. Falls back to the full list when nothing matches so you can always pick someone.

### Create a ticket

- **Description box now supports formatting.** Toolbar with bold, italic, underline, strikethrough, bulleted/numbered lists, and links. Pasting from Word, Google Docs, or other rich sources keeps the formatting (including bullets) instead of dropping it. Detail view renders descriptions with the same formatting.

### Replies + internal notes

- **Reply box now supports formatting too.** Same toolbar as the new-ticket description. Pasted bullets and links survive the round-trip. Old plain-text replies render the same as before. @-mention autocomplete is temporarily off while we wire it into the rich editor — you can still type @Name as text.
- **"New Ticket" works again** after the master-detail tickets layout regression earlier today.
- **Bulleted and numbered list markers now display.** Lists you create in the editor — and lists in messages already in the system — now render with proper bullets/numbers in both the editor and the conversation view.

### Admin · Users

- **Users table now paginates at 15 per page** with Previous/Next and page-number buttons. The page resets to 1 when you change the search box or role filter.

### Ticket list

- **Searching by ticket ID (e.g. `T-1093`) now finds tickets outside your current view.** If you're on Open Tickets and search for a ticket that's been Solved, it'll still surface. Title/keyword search still scopes to the current view.

### Create a ticket

- **Pasted screenshots in the description now attach as files** (same behavior the reply box already had). They show up in the Attachments list instead of being dropped silently or bloating the ticket body.

### Inbound email

- **Embedded images in email replies now display in the conversation.** Previously the sanitizer stripped them. External image URLs are kept (so logos and screenshots render) but are loaded with `referrerpolicy="no-referrer"` and `loading="lazy"` to limit tracking. Inline `data:` URIs are still blocked to prevent oversized rows.

### Ticket detail

- **Clicking an inline image thumbnail now opens a preview.** Previously only the thumbnails in the bottom Attachments section opened the lightbox; thumbnails inside the message thread silently did nothing.

### Tickets workspace

- **Views and ticket-list columns can now be collapsed.** Click the small panel icon in the Views header (or the chevron at the top of the ticket-list column) to hide it; click again on the thin strip to bring it back. Each column's collapsed state is remembered across reloads.

### Reply composer

- **Submit-as button now follows the right-sidebar status.** Picking a status in the Ticket Details panel (Solved, Pending, etc.) updates the Submit-as button to match — picking Solved makes the button say "Submit as Solved" instead of silently flipping to "Submit as Open".
- **Replies on Solved tickets keep them solved by default.** You can still reply to (and attach images to) a solved ticket. The Submit-as button will say "Submit as Solved" so a follow-up reply doesn't accidentally re-open the ticket. Use the dropdown caret if you want to advance/regress the status explicitly.

### Create a ticket

- **The Submit Ticket button is reachable again.** The new-ticket form was being clipped at the bottom by the master-detail layout's height constraint, so as conditional fields (Category, Sub-category, mailing address) appeared, the Submit button could disappear off-screen with no way to scroll. The form now scrolls inside its own container.
- **Cancel and Submit are now a sticky footer at the bottom of the form.** Even on a long form, you no longer have to scroll all the way down to submit — the buttons stay docked at the bottom of the form area.

### Replies + internal notes

- **`@`-mention picker is back in the reply composer.** Type `@` to open a picker; arrow keys to navigate, Enter or click to select. The mentioned user shows as a blue chip, gets the @-mention notification, and the reply renders the chip in the conversation. Same picker is available for both Public Replies and Internal Notes.

### Admin

- **Creating canned responses, routing rules, SLA policies, teams, and views works again.** The Save/Create button was silently failing because those five tables required a primary-key `id` on insert and the UI didn't supply one. The DB now auto-generates a UUID id on insert, so create-from-the-UI flows succeed.
- **Teams admin page** at Admin → Teams. Add, rename, or delete teams from the UI; previously you could only edit existing teams and `Doc Magic Support` / `System Support` weren't even selectable in routing rules until they were added directly to the database. Both are now in the list.

### Dashboard

- **Recent Requests sorts by latest activity, not creation date.** Solving or replying to a ticket now keeps it at the top of Recent Requests instead of falling off because its create date is older. Column is now labeled "Updated" to match. Showing 8 instead of 5 to give room for both fresh and recently-solved.

### Reply composer

- **Submit-as button works for status-only changes.** Pick a status from the right-hand sidebar without typing anything in the composer — the button enables and reads "Mark as &lt;status&gt;" so you can flip a ticket to Solved/Pending/On Hold without first having to type "you're welcome".
- **Auto-assign on solve.** Marking an unassigned ticket Solved now claims it for whoever solved it. If the ticket was already assigned to someone, that assignee stays. Helps the "solved by no-one" graveyard problem when tickets sit in a team queue.

### Tickets list

- **Assignee column is sortable.** Click the Assignee header to sort tickets alphabetically by assignee name (unassigned tickets sort to the bottom).

### Print

- **Printing a ticket now includes the full conversation.** The conversation pane was being clipped to the visible scroll viewport; print rules now release that constraint and hide chrome (sidebar nav, view list, ticket list, composer, action buttons), leaving the ticket header + conversation + sidebar details in the printout.

## 2026-04-22

### Ticket replies by email

- **You can now reply to a ticket by email and the ticket updates instantly for everyone watching.** When a notification email arrives, hitting Reply in Gmail/Outlook/phone sends your response straight to the ticket — no login needed. Quoted history and signatures are cleaned up automatically. If the ticket was already marked solved, it reopens. Agents looking at the ticket see the new reply appear live, no refresh.

### Out of Office

- **Toggling OOO on no longer unassigns your open tickets.** Your current tickets stay assigned to you so you can pick them back up when you return. New tickets that come in while you're OOO route to your team but skip past you — the next available teammate gets them.

### Create a ticket

- **Agents and admins can submit on behalf of another user.** New optional "Requester" field on the Create Ticket form, visible only to agents and admins. Leave it blank to submit as yourself (unchanged default). Pick a user to attribute the ticket to them — the selected requester shows as the ticket creator, receives the creation email, and the agent who hit submit is no longer in the loop unless they CC themselves. The chosen requester is automatically excluded from the CC picker. Server-side (`POST /api/tickets`) validates that the caller is an agent or admin and that the requester exists before overriding `created_by`; employees cannot override the requester.

## 2026-04-21

### Ticket list

- **Column headers drive sorting — dropdown and ASC/DESC button removed.** Click a column to sort ascending, click again for descending, click a third time to clear the sort and return to the default order.

### Ticket detail

- **Attachments section is collapsible.** Tickets with many attachments no longer hide the conversation. Starts collapsed with a count; click to expand.
- **Long unbroken strings no longer stretch the page.** Added `min-w-0` on the portal `<main>` and the conversation pane, plus header flex containers, so a 300-char no-space string wraps instead of forcing a horizontal scroll.
- **Admins can change a ticket's Department from the sidebar.** New Department dropdown (sourced from Admin → Departments & Categories). Changing department clears the category so you must pick one that belongs to the new department. Requires `useUpdateTicket` payload to accept `ticketType` and `subCategory` — added.
- **Sidebar Category/Sub-category dropdowns use admin-managed taxonomy.** Previously the sidebar had its own hard-coded `CATEGORY_OPTIONS` (Loan Origination, Underwriting, etc.) that didn't match real ticket data. Replaced with `useDepartmentCategories()`, filtered by the ticket's current department.
- **Auto-save toast on sidebar field changes.** Status/priority/department/category/assignee/team edits were already auto-saving; now a 1.5 s confirmation toast fires on success (and an error toast on failure) so admins aren't guessing whether the change stuck.

### Reply composer

- **@mention dropdown no longer clips avatars.** Replaced the inner `overflow-hidden` with explicit `rounded-t-lg` / `rounded-b-lg` on the composer's top/bottom strips so the mention popover (positioned `bottom-full`) isn't clipped by the composer bounds.
- **Attachment size limit raised to 20 MB.** Updated `FileUpload` default, create-ticket form override, and the `/api/upload` server-side cap + error message. Matches the Supabase Storage bucket limit.

### Profile page / Admin cards

- **CardHeader with `bg-muted/50` is now flush with the top of its Card.** The `Card` component had `py-4` that leaked through above a colored `CardHeader`, producing a half-gray / half-white header. Fixed at the component level (`has-data-[slot=card-header]:pt-0` on Card, `[.border-b]:py-4` on CardHeader), which also cleans up Admin → Categories, Branding, Regions & Branches, and Custom Fields.

### Deployments

- **"New version available" banner.** Added `GET /api/version` returning `VERCEL_GIT_COMMIT_SHA`. A client-side `<VersionBanner>` component polls it every 5 minutes and on window focus; when the returned version differs from the one first loaded, it shows a sticky blue banner with a Refresh button. Never fires in local dev (both sides return `dev`). Added to portal layout above the AssumeUserBanner; `/api/version` is in the middleware's public-route list so it works even if a session has expired.

## 2026-04-20

### Fixes

- **Ticket create form no longer pre-selects a department.** Closing Support was being selected by default, which could cause tickets to be submitted against the wrong team. The department is now blank until you pick one.
- **New ticket priority defaults to Low.** Previously defaulted to Medium.
- **New departments, categories and sub-categories now show up in the ticket create form.** The form used to read from a hard-coded list, so anything added under **Admin → Departments & Categories** was ignored. It now reads directly from that settings page, so new items ("Other", custom categories, sub-categories, etc.) are available to submitters immediately.
- **SLA settings now use your real departments and categories** instead of a separate hard-coded list, so the options you pick match what tickets actually use.
- **Tickets no longer auto-assign to a specific agent on submission.** New tickets route to the department/team queue and wait for an agent to claim them.
- **Conditional custom fields.** Admins can configure a custom field to appear only when other ticket fields match certain values — e.g. show "Loan File Number" only when Category is "Closing Exceptions", or show "Hardware Model" only when Priority is High or Urgent. Set rules under **Admin → Custom Fields → (field) → Display Conditions**. Requires running migration `005_custom_field_conditions.sql`.
- **SLA timer now stops ticking against the original post once an agent replies.** Previously the list view was missing the data needed to detect the reply, so SLA could keep showing as overdue even after an answer went out.

### Ticket detail page

- **Drag and drop files onto the conversation** to attach them to your next reply.
- **Attachment icon stays clickable after adding a single file.** You can now click the paperclip repeatedly to add more files.
- **Conversation stays visible with 6+ attachments.** The attachments list is now height-capped with its own scroll so the thread isn't pushed off screen.
- **Every message gets the same card styling.** The first message used to have a border while replies had none; now they match.
- **Long titles and long messages wrap correctly** instead of stretching the page horizontally.
- **Back button on a ticket reliably returns to your ticket list**, even when you opened the ticket directly from a link or email.

### Notifications

- **Notifications panel closes when you click outside of it.** Previously you had to click the bell icon a second time to dismiss it.

### Security / UI

- **Admin/agent navigation no longer flashes to employees on login.** The sidebar now waits for your role to load before showing menu items, so employees never briefly see admin-only links.
- **Session timeout policy set to 7-day rolling.** Your login stays active while you use the portal; after 3 days of inactivity you're signed out automatically, even if the 7-day ceiling has not been reached. (Enable **Inactivity timeout = 3 days** in **Clerk Dashboard → Sessions** — this is the only step; Clerk enforces it server-side.)
