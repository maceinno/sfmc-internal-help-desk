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
