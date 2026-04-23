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
    date: '2026-04-22',
    sections: [
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
