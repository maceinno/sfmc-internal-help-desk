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
