'use client'

import * as React from 'react'
import { Sparkles, ChevronDown, ChevronUp, ClipboardCheck } from 'lucide-react'
import { CHANGELOG, type ChangelogItem, type ChangelogHowToTest } from '@/data/changelog'
import { useCurrentUser } from '@/hooks/use-current-user'

function formatDate(iso: string): string {
  // Render as e.g. "April 20, 2026" without pulling in a date library.
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

type Role = 'employee' | 'agent' | 'admin'

const ROLE_LABEL: Record<Role, string> = {
  employee: 'Employee',
  agent: 'Agent',
  admin: 'Admin',
}

/**
 * Inset panel under a changelog item with a role tab strip + numbered
 * steps for the selected role. Defaults the active tab to the current
 * user's role when possible, falling back to the first role with steps.
 */
function HowToTestPanel({
  steps,
  currentRole,
}: {
  steps: ChangelogHowToTest
  currentRole: Role | null
}) {
  const availableRoles = React.useMemo<Role[]>(
    () =>
      (['employee', 'agent', 'admin'] as Role[]).filter(
        (r) => (steps[r]?.length ?? 0) > 0,
      ),
    [steps],
  )

  const initialRole: Role =
    (currentRole && availableRoles.includes(currentRole) ? currentRole : null) ??
    availableRoles[0] ??
    'employee'

  const [activeRole, setActiveRole] = React.useState<Role>(initialRole)

  if (availableRoles.length === 0) return null
  const active = steps[activeRole] ?? []

  return (
    <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
        <ClipboardCheck className="h-3.5 w-3.5" />
        How to test
      </div>

      {availableRoles.length > 1 && (
        <div
          role="tablist"
          aria-label="How to test, by role"
          className="mb-3 inline-flex rounded-md border border-gray-200 bg-white p-0.5"
        >
          {availableRoles.map((r) => (
            <button
              key={r}
              role="tab"
              aria-selected={r === activeRole}
              type="button"
              onClick={() => setActiveRole(r)}
              className={
                r === activeRole
                  ? 'rounded px-3 py-1 text-xs font-medium bg-amber-100 text-amber-900'
                  : 'rounded px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-900'
              }
            >
              {ROLE_LABEL[r]}
              {r === currentRole && (
                <span className="ml-1 text-[10px] text-gray-400">(you)</span>
              )}
            </button>
          ))}
        </div>
      )}

      <ol className="ml-5 list-decimal space-y-1.5 text-sm text-gray-700">
        {active.map((step, idx) => (
          <li key={idx}>{step}</li>
        ))}
      </ol>
    </div>
  )
}

/**
 * One bullet item in a section. Adds the expandable "How to test" toggle
 * when the item has at least one role's worth of steps.
 */
function ChangelogItemRow({
  item,
  currentRole,
}: {
  item: ChangelogItem
  currentRole: Role | null
}) {
  const [open, setOpen] = React.useState(false)
  const hasSteps =
    !!item.howToTest &&
    Object.values(item.howToTest).some(
      (s) => Array.isArray(s) && s.length > 0,
    )

  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900">{item.title}</p>
        {item.body && (
          <p className="mt-0.5 text-sm text-gray-600">{item.body}</p>
        )}
        {hasSteps && (
          <>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-800"
            >
              {open ? (
                <>
                  Hide how to test <ChevronUp className="h-3 w-3" />
                </>
              ) : (
                <>
                  How to test <ChevronDown className="h-3 w-3" />
                </>
              )}
            </button>
            {open && (
              <HowToTestPanel
                steps={item.howToTest!}
                currentRole={currentRole}
              />
            )}
          </>
        )}
      </div>
    </li>
  )
}

export default function WhatsNewPage() {
  const { profile } = useCurrentUser()
  const currentRole: Role | null =
    profile?.role === 'employee' ||
    profile?.role === 'agent' ||
    profile?.role === 'admin'
      ? profile.role
      : null

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 flex items-center gap-3">
        <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">What&apos;s New</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Fixes and improvements to the help desk. Click &quot;How to test&quot;
            on any entry for step-by-step verification tailored to your role.
          </p>
        </div>
      </div>

      <div className="space-y-8">
        {CHANGELOG.map((entry) => (
          <article
            key={entry.date}
            className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <header className="mb-5 flex items-baseline justify-between gap-3 border-b border-gray-100 pb-3">
              <h2 className="text-lg font-semibold text-gray-900">
                {formatDate(entry.date)}
              </h2>
              {entry.label && (
                <span className="text-xs font-medium text-muted-foreground">
                  {entry.label}
                </span>
              )}
            </header>

            <div className="space-y-6">
              {entry.sections.map((section) => (
                <section key={section.heading}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {section.heading}
                  </h3>
                  <ul className="space-y-3">
                    {section.items.map((item) => (
                      <ChangelogItemRow
                        key={item.title}
                        item={item}
                        currentRole={currentRole}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
