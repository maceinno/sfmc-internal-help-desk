/**
 * User-facing changelog entries, rendered at /whats-new.
 *
 * Keep language plain — employees should be able to read this without a
 * technical background. Put newest releases on top. Group related fixes
 * under a short heading inside a release.
 *
 * CHANGELOG.md at the repo root mirrors this data for docs; when you add a
 * fix, update both files.
 */

export interface ChangelogItem {
  title: string
  body?: string
}

export interface ChangelogSection {
  heading: string
  items: ChangelogItem[]
}

export interface ChangelogEntry {
  /** ISO date (YYYY-MM-DD). */
  date: string
  /** Optional release name/tag. */
  label?: string
  sections: ChangelogSection[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-04-30',
    sections: [
      {
        heading: 'Ticket detail',
        items: [
          {
            title: '"Take it" button — claim an unassigned ticket in one click',
            body: 'When a ticket is sitting unassigned in a team queue, the right-hand panel now shows a small "Take it" button next to the Assignee label. Click it to assign the ticket to yourself without having to open the assignee picker and search for your name. Hides itself once the ticket is assigned to anyone.',
          },
          {
            title: 'Status-only submit works on every ticket',
            body: 'The Submit button in the reply composer was getting stuck disabled on tickets whose status defaulted to its current value (Pending, On Hold, Solved). You can now select any status from the caret dropdown and submit without typing a reply, on any ticket. Selecting the status the ticket already has is a no-op (no DB write, no false "saved" toast).',
          },
          {
            title: 'Status and assignment changes show inline in the conversation',
            body: 'When someone changes a ticket\'s status (Open → Solved, etc.) or assigns it, an inline event line now appears in the conversation thread — "Jane Doe changed status from Open to Solved · Apr 30, 2026, 4:12 PM" — so anyone reading later sees what happened in context. The lines are intentionally muted so they don\'t compete with replies. Reply emails still only quote real replies (system events are filtered out of the thread an outbound email shows).',
          },
        ],
      },
    ],
  },
  {
    date: '2026-04-29',
    sections: [
      {
        heading: 'Ticket detail · Sidebar',
        items: [
          {
            title: 'Team dropdown shows the team name (not its database id)',
            body: 'On the right-hand ticket details panel the Team dropdown was rendering the underlying database id (e.g. "93581d07-a3bb-488a-…") in the trigger instead of the team name. Same fix applied to the Assign-to-User and Assign-to-Team pickers in Admin → Routing rules.',
          },
        ],
      },
      {
        heading: 'Dates in lists',
        items: [
          {
            title: 'Ticket lists and dashboard rows now show date AND time',
            body: 'The Created column on the main ticket list, the Updated column in Recent Requests on the dashboard, and attachment upload timestamps were all showing only the date — easy to misread two events on the same day. They now show date and time in your local timezone (e.g. "Apr 29, 2026, 3:42 PM"). The merge-ticket preview also picks up the same format. Date-only displays where they make sense (release headers, holiday lists, chart axis labels) are unchanged.',
          },
        ],
      },
      {
        heading: 'Email notifications',
        items: [
          {
            title: 'Team members get an email when a new ticket lands in their queue',
            body: 'Previously, a new ticket routed to a team queue (no specific agent assigned) sent an email to the requester only — no one on the team was notified, so tickets could sit unseen until someone refreshed the queue. Now every active member of the assigned team (agents and admins, skipping anyone marked Out of Office or the requester themselves) gets a "New Ticket in Your Team Queue" email with a link to view and claim it.',
          },
          {
            title: 'CC\'d users get an email when added to a ticket',
            body: 'When you CC someone — either while creating a ticket or by adding them later from the ticket sidebar — they now get a "You\'ve been CC\'d" email with a link straight to the ticket. Previously they\'d sit silently on the thread until someone replied, and only the reply emails would surface that they were involved.',
          },
          {
            title: 'CC\'d users get notified on status changes',
            body: 'When a ticket is moved to Solved / Pending / On Hold / Open / New, every user CC\'d on the ticket now receives the same status-change email the requester gets. They no longer have to find out the ticket was resolved by checking back manually.',
          },
        ],
      },
      {
        heading: 'Employee experience',
        items: [
          {
            title: 'Employees no longer see the agent Views sidebar',
            body: 'When an employee opens "Create Ticket" or any of their own tickets, the page now goes straight to the form/detail without the agent-oriented Views panel (All Tickets / My Queue / By Status / SLA At Risk / etc.) on the left. That panel was bleeding through into employee pages because it was part of the shared tickets layout. Agents and admins still see the full Views sidebar as before.',
          },
          {
            title: 'Open-tickets tab strip only shows on Agent Views',
            body: 'The multi-tab strip at the top of the content area (showing recently opened tickets like T-1065, T-1139, etc.) was rendering on every portal page — Dashboard, CC\'d Tickets, Reports, even What\'s New. It now only appears under Agent Views (/tickets/...) and only for users who actually use that area (agents + admins). Employees never see it at all.',
          },
          {
            title: '"What\'s New" is now admin-only',
            body: 'The What\'s New release feed is intended for admins, so the sidebar link now appears only for admins and the /whats-new URL redirects non-admins to the appropriate landing page (dashboard for agents, /my-tickets for employees).',
          },
          {
            title: 'Create Ticket form is no longer wrapped by the agent queue',
            body: 'When agents/admins clicked Create Ticket, the page used to render with the Views sidebar on the left and the master ticket queue in the middle — visual noise that had nothing to do with creating a new ticket. The new-ticket form now renders by itself, the same way it does for employees.',
          },
          {
            title: 'Employees who land on the global tickets list go to My Tickets',
            body: 'If an employee navigates directly to the /tickets URL, they are redirected to /my-tickets. The global ticket triage view is intended for agents and admins.',
          },
        ],
      },
      {
        heading: 'SLA policies',
        items: [
          {
            title: 'Ticket lists now actually use the SLA policies you configure',
            body: 'A bug meant the main ticket list was ignoring your SLA policies entirely and falling back to a hardcoded table (urgent=2h, high=4h, medium=8h, low=24h). That\'s why disabling a policy didn\'t change anything in the list view. Every place that shows an SLA badge — ticket list, view filters, dashboard, ticket detail, the SLA cron — now reads from your real Admin → SLA policies and respects each department\'s schedule (business hours / timezone).',
          },
          {
            title: 'Tickets with no matching SLA policy show no SLA',
            body: 'Previously when no policy matched, a hidden priority-based default deadline kicked in silently. Now a ticket with no matching policy simply has no SLA badge — turning a policy off actually does what you\'d expect. If you want a global default, configure a catch-all policy with all conditions set to "Any".',
          },
          {
            title: 'You can turn off First Reply or Next Reply per policy',
            body: 'Each metric in a policy now has a "Track" switch. Flip it off and that metric is N/A — useful for policies where you only care about first response time, or want to test by disabling next reply.',
          },
          {
            title: 'Delete button on every SLA policy',
            body: 'Built-in seeded policies were previously locked to disable-only. Now any policy can be deleted from the admin editor (with a confirm). The "Built-in" badge stays as informational only.',
          },
        ],
      },
      {
        heading: 'Admin · Users',
        items: [
          {
            title: 'Removed "Ticket Types Handled" from the user editor',
            body: 'The user edit dialog had three overlapping fields that were doing similar jobs — Team Assignments, Departments, and Ticket Types Handled. "Ticket Types Handled" was being collected but not actually used to drive anything in the app, so we removed it. Going forward, assign each user to their native Team and pick the Departments they can support; the assignee picker on a ticket already uses Departments.',
          },
        ],
      },
      {
        heading: 'Reply composer',
        items: [
          {
            title: 'Submit-as status picker works again',
            body: 'Picking a different status from the small caret menu next to the Submit button (Open / Pending / On Hold / Solved / Send-no-status-change) now actually changes the button label and submits with that status. The picker had been silently doing nothing — particularly noticeable on Solved tickets where you wanted to reply and reopen as Pending or Open.',
          },
          {
            title: 'Click anywhere in the reply box to start typing',
            body: "The cursor now lands on the first click no matter where in the reply area you click. Previously the placeholder text \"Type your reply...\" showed mid-way down the box and only a small region was actually focusable, so you'd have to hunt for the right spot.",
          },
          {
            title: 'Visible progress indicator while a reply is sending',
            body: 'A thin animated bar runs across the top of the reply box while your reply is posting (blue for replies, amber for internal notes), so it\'s clear something is happening between clicking Submit and seeing the new message in the thread. The button still shows "Sending..." too.',
          },
        ],
      },
    ],
  },
  {
    date: '2026-04-27',
    sections: [
      {
        heading: 'Ticket replies',
        items: [
          {
            title: 'Changing status while a reply is typed sends the reply too',
            body: "If you've typed a reply in the composer and then click a status (Solved, Pending, etc.) in the right-hand Ticket Details panel, the reply now sends along with the status change as a single action — same as Zendesk. Works for internal notes too: typed note + status change posts both. The Submit-as-&lt;status&gt; split button continues to work as before.",
          },
        ],
      },
      {
        heading: 'Ticket detail',
        items: [
          {
            title: 'Assignee dropdown only shows agents who handle this department',
            body: "The assignee picker no longer lists every agent across the company. It now shows admins plus agents whose department list includes the ticket's department, which keeps the menu manageable as the team grows. If no agent matches, it falls back to the full list so you can still pick someone.",
          },
        ],
      },
      {
        heading: 'Create a ticket',
        items: [
          {
            title: 'Description box now supports formatting (bold, bullets, links)',
            body: 'The description field is now a rich-text editor with a toolbar for bold, italic, underline, strikethrough, bulleted/numbered lists, and links. Pasting from Word, Google Docs, or other rich sources keeps the formatting (including bullets) instead of dropping it. The detail view renders descriptions with the same formatting.',
          },
        ],
      },
      {
        heading: 'Replies + internal notes',
        items: [
          {
            title: 'Reply box now supports formatting too',
            body: "Same toolbar as the new-ticket description — bold/italic/underline/strikethrough/bulleted/numbered/link. Pasted formatting is preserved. Past plain-text replies render the same as before; new replies render with their formatting in the conversation. @-mention autocomplete is temporarily off while we wire it into the rich editor; you can still type @Name as text.",
          },
          {
            title: '"New Ticket" works again from the new tickets layout',
            body: "Quick fix to a regression introduced earlier today: the master-detail tickets layout was treating /tickets/new as the no-detail branch and rendering the ticket list instead of the form. The form is back.",
          },
          {
            title: 'Bulleted and numbered list markers now display',
            body: 'Lists created with the toolbar — or pasted in from Word/Google Docs/Slack — now render with bullets and numbers in both the editor and the conversation view. Same fix applies to ticket descriptions.',
          },
        ],
      },
      {
        heading: 'Admin · Users',
        items: [
          {
            title: 'Users table now paginates at 15 per page',
            body: 'Previous/Next plus per-page buttons. The page resets to 1 when you change the search box or role filter so you stay on results that exist.',
          },
        ],
      },
      {
        heading: 'Ticket list',
        items: [
          {
            title: 'Search by ticket ID finds tickets outside your current view',
            body: "Searching for a ticket ID like T-1093 now searches across all tickets you have access to, not just the current view. Useful when you know the ID but don't remember which queue the ticket lives in. Title/keyword search still scopes to the current view.",
          },
        ],
      },
      {
        heading: 'Create a ticket',
        items: [
          {
            title: 'Pasted screenshots attach as files',
            body: 'Pasting an image into the description now attaches it (matching how the reply composer already worked). The image shows up in the Attachments list rather than being dropped or stuffed inline as a multi-megabyte data URL.',
          },
        ],
      },
      {
        heading: 'Inbound email',
        items: [
          {
            title: 'Embedded images in email replies display in the conversation',
            body: 'External-image URLs are kept so company logos and screenshots render, but they load with no-referrer + lazy hints to limit tracking. Inline data-URI images are still stripped to keep ticket rows from ballooning.',
          },
        ],
      },
      {
        heading: 'Ticket detail',
        items: [
          {
            title: 'Inline image thumbnails open a preview when clicked',
            body: 'Thumbnails inside the message thread now open the same lightbox that the bottom Attachments section already used. Previously they were silently inert.',
          },
        ],
      },
      {
        heading: 'Tickets workspace',
        items: [
          {
            title: 'Collapse the Views and ticket-list columns to widen the active ticket',
            body: 'A small panel icon in the Views header hides that column; a chevron at the top of the ticket-list column hides that one. A thin strip stays in place so you can re-expand with a click. Each column remembers its state across reloads, per browser.',
          },
        ],
      },
      {
        heading: 'Reply composer',
        items: [
          {
            title: 'Submit-as button mirrors the right-sidebar status',
            body: 'Picking a status in the Ticket Details panel (Solved, Pending, On Hold, etc.) now updates the Submit-as button to match. Previously the button could be saying "Submit as Open" while the sidebar showed Solved, which led to accidental re-opens.',
          },
          {
            title: 'Solved tickets accept replies without auto-reopening',
            body: 'You can still type a reply, attach images, and submit on an already-solved ticket. The Submit-as button now defaults to "Submit as Solved" so a clarifying follow-up doesn\'t silently reopen it. Use the chevron next to the button to pick a different status if you want to advance or regress.',
          },
        ],
      },
      {
        heading: 'Create a ticket',
        items: [
          {
            title: 'Submit Ticket button is reachable again on the new-ticket form',
            body: 'The new-ticket form was being clipped at the bottom by the master-detail layout — as conditional fields like Category and Sub-category appeared, the Submit button could vanish off-screen with no way to scroll to it. The form now scrolls inside its own container so the bottom is always reachable.',
          },
          {
            title: 'Cancel and Submit are now a sticky footer at the bottom of the form',
            body: "On longer forms (with conditional Category, Sub-category, and mailing-address fields) the action buttons now stay docked at the bottom of the form area. You don't have to scroll to find them — they're always visible while you fill the form.",
          },
        ],
      },
      {
        heading: 'Replies + internal notes',
        items: [
          {
            title: '@-mention picker is back in the reply composer',
            body: 'Type @ in a reply or internal note to open a picker for the user list. Arrow keys to navigate, Enter or click to insert. The mentioned user shows as a blue chip in the editor, gets a notification when the reply posts, and the chip renders the same way in the conversation thread.',
          },
        ],
      },
      {
        heading: 'Admin',
        items: [
          {
            title: 'Creating canned responses, routing rules, SLA policies, teams, and views works again',
            body: "The Save/Create button on those five admin pages was silently failing because the underlying tables required a primary-key id on insert and the UI didn't provide one. The database now auto-generates a UUID id when one is omitted, so the create-from-the-UI flows succeed.",
          },
          {
            title: 'Admin → Teams page added',
            body: "Add, rename, and delete teams from the admin panel. Previously you could only edit teams that already existed; new teams (like Doc Magic Support and System Support) had to be inserted manually. Both are now seeded and the page is available from the admin tabs.",
          },
        ],
      },
      {
        heading: 'Dashboard',
        items: [
          {
            title: 'Recent Requests sorts by latest activity, not creation date',
            body: 'Solving or replying to a ticket keeps it at the top of Recent Requests instead of falling off because its create date is older. Column is now labeled Updated and shows 8 entries.',
          },
        ],
      },
      {
        heading: 'Reply composer',
        items: [
          {
            title: 'Submit-as button works for status-only changes (Mark as Solved without typing)',
            body: 'Pick a status from the right-hand sidebar without typing in the composer — the button now enables and reads "Mark as <status>" so you can flip a ticket to Solved/Pending/On Hold without first typing "you\'re welcome".',
          },
          {
            title: 'Auto-assign on solve for unassigned tickets',
            body: 'Marking an unassigned ticket Solved claims it for whoever solved it. If the ticket was already assigned, the existing assignee stays. Stops the "solved by no-one" graveyard for tickets sitting in a team queue.',
          },
        ],
      },
      {
        heading: 'Tickets list',
        items: [
          {
            title: 'Assignee column is sortable',
            body: 'Click the Assignee header to sort tickets alphabetically by assignee name. Unassigned tickets fall to the bottom regardless of direction.',
          },
        ],
      },
      {
        heading: 'Print',
        items: [
          {
            title: 'Printing a ticket includes the full conversation',
            body: 'The conversation pane was being clipped to the visible scroll viewport so most messages disappeared from the print preview. Print now releases that constraint and hides app chrome (sidebar nav, view list, ticket list, composer, action buttons), leaving the ticket header, sidebar details, and the entire conversation thread in the printout.',
          },
        ],
      },
    ],
  },
  {
    date: '2026-04-22',
    sections: [
      {
        heading: 'Ticket replies by email',
        items: [
          {
            title: 'Reply to tickets by email — and watch it appear live',
            body: 'When a notification email arrives, hitting Reply sends your response straight to the ticket — no login needed. Quoted history and signatures are trimmed automatically. Solved tickets reopen when a user replies. Agents viewing the ticket see new replies appear instantly without refreshing.',
          },
        ],
      },
      {
        heading: 'Out of Office',
        items: [
          {
            title: 'OOO no longer unassigns your open tickets',
            body: 'Turning on Out of Office used to dump all your open tickets back into the group queue. It now leaves your current tickets assigned to you so you can pick up where you left off when you return. New tickets route to your team but skip past you while OOO — the next available teammate gets them.',
          },
        ],
      },
      {
        heading: 'Create a ticket',
        items: [
          {
            title: 'Agents and admins can submit on behalf of another user',
            body: 'The Create Ticket form has a new Requester field visible only to agents and admins. Leave it blank to submit as yourself (unchanged behavior), or pick a user to attribute the ticket to them. The chosen requester shows as the ticket creator, receives the confirmation email, and can reply like any other end user.',
          },
        ],
      },
    ],
  },
  {
    date: '2026-04-21',
    sections: [
      {
        heading: 'Ticket list',
        items: [
          {
            title: 'Column headers drive sorting — dropdown and ASC/DESC button removed',
            body: 'Click a column header to sort. Click again to flip direction. Click a third time to clear the sort and return to the default order. Cleaner and less redundant than the previous dropdown + toggle button combo.',
          },
        ],
      },
      {
        heading: 'Ticket detail',
        items: [
          {
            title: 'Attachments section is collapsible',
            body: "Tickets with lots of attachments no longer hide the conversation. The attachments row starts collapsed with a count; click to expand and review.",
          },
          {
            title: 'Long strings stop stretching the page horizontally',
            body: 'An unbroken 300-character string in a title or message body now wraps instead of forcing a horizontal scrollbar on the whole portal.',
          },
          {
            title: 'Admins can now change a ticket\'s Department',
            body: 'Previously only Category and Team were editable from the ticket sidebar. Added a Department dropdown (sourced from Admin → Departments & Categories). Changing department clears the category so you must re-pick a matching one.',
          },
          {
            title: 'Category and Sub-category dropdowns use real admin data',
            body: 'The sidebar category picker no longer uses a separate hard-coded list. It reads from Admin → Departments & Categories, filtered by the ticket\'s current department, and a Sub-category picker appears automatically when the chosen category has sub-options.',
          },
          {
            title: 'Sidebar edits auto-save with a confirmation toast',
            body: "Status, priority, department, category, assignee, and team changes save as soon as you pick them — and you'll see a small confirmation toast so you know it stuck. No need to send a reply to persist.",
          },
        ],
      },
      {
        heading: 'Reply composer',
        items: [
          {
            title: '@mention dropdown no longer clips user avatars',
            body: 'The user picker that pops up when you type "@" now renders the full avatar and name for every suggestion.',
          },
          {
            title: 'Attachment limit raised from 10 MB to 20 MB',
            body: 'You can now upload files up to 20 MB per attachment. Drop zone helper text updated to match.',
          },
        ],
      },
      {
        heading: 'Profile page',
        items: [
          {
            title: 'Profile Details header background is consistent',
            body: 'The employee Profile Details card header no longer shows as half-gray, half-white. Same fix applies anywhere a gray header sat inside a padded card (admin Categories, Branding, Regions & Branches, Custom Fields).',
          },
        ],
      },
      {
        heading: 'Deployments',
        items: [
          {
            title: 'Automatic "new version available" banner',
            body: 'When a new version is deployed, any open portal tab shows a blue banner at the top prompting you to refresh. The banner appears within 5 minutes of the deploy (or immediately if you switch back to the tab), and clicking Refresh reloads the page to the latest code.',
          },
        ],
      },
    ],
  },
  {
    date: '2026-04-20',
    sections: [
      {
        heading: 'Ticket creation',
        items: [
          {
            title: 'Department dropdown no longer defaults to Closing Support',
            body: 'The department is blank until you pick one, so tickets stop accidentally routing to the wrong team.',
          },
          {
            title: 'Priority now defaults to Low',
            body: 'Previously defaulted to Medium.',
          },
          {
            title: 'New departments, categories and sub-categories appear immediately',
            body: 'The form used to read from a hard-coded list. It now reads directly from Admin → Departments & Categories, so anything you add there (including "Other") is usable right away.',
          },
          {
            title: 'Tickets no longer auto-assign to a specific agent',
            body: 'New tickets route to the department/team queue and wait for an agent to claim them.',
          },
          {
            title: 'Conditional custom fields',
            body: 'Admins can now configure a custom field to appear only when other ticket fields match certain values — e.g. show "Loan File Number" only when Category is "Closing Exceptions", or show "Hardware Model" only when Priority is High or Urgent. Set rules under Admin → Custom Fields → (field) → Display Conditions.',
          },
        ],
      },
      {
        heading: 'Ticket detail page',
        items: [
          {
            title: 'Drag and drop files onto the conversation',
            body: 'Files you drop anywhere on the conversation pane attach to your next reply.',
          },
          {
            title: 'Attachment icon stays clickable after the first file',
            body: 'You can click the paperclip repeatedly to add more files, not just once.',
          },
          {
            title: 'Conversation stays visible with 6+ attachments',
            body: 'The attachments list is height-capped with its own scroll so the thread is never pushed off screen.',
          },
          {
            title: 'Every message uses the same card styling',
            body: 'The first message used to have a border while replies had none; now they match.',
          },
          {
            title: 'Long titles and long messages wrap correctly',
            body: 'Long content no longer stretches the ticket detail page horizontally.',
          },
          {
            title: 'Back button on a ticket reliably returns to your ticket list',
            body: 'Works even when you opened the ticket directly from a link or email.',
          },
        ],
      },
      {
        heading: 'SLA',
        items: [
          {
            title: 'SLA timer now stops ticking against the original post after an agent replies',
            body: 'The ticket list was missing the data needed to detect the reply, so SLA could keep showing overdue even after an answer went out.',
          },
          {
            title: 'SLA settings use your real departments and categories',
            body: 'The SLA admin page reads from Admin → Departments & Categories instead of a separate hard-coded list, so the options you pick match what tickets actually use.',
          },
        ],
      },
      {
        heading: 'Notifications',
        items: [
          {
            title: 'Notifications panel closes when you click outside it',
            body: 'Previously you had to click the bell icon a second time to dismiss it.',
          },
        ],
      },
      {
        heading: 'Security / UI',
        items: [
          {
            title: 'Admin/agent navigation no longer flashes to employees on login',
            body: 'The sidebar waits for your role to load before showing menu items, so employees never briefly see admin-only links.',
          },
          {
            title: 'Session timeout policy set to 7-day rolling',
            body: 'Your login stays active as long as you use the portal. After 3 days of inactivity you will be signed out automatically, even if the 7-day ceiling has not been reached.',
          },
        ],
      },
    ],
  },
]
