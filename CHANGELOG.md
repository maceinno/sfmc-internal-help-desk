# Changelog

User-facing record of fixes and improvements to the SFMC Internal Help Desk.
Keep entries short and plain-English — employees should be able to read this.
Newest entries go on top.

This file mirrors the data rendered in-app at **/whats-new**
(source: `src/data/changelog.ts`). When you add a fix, update both files.

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
