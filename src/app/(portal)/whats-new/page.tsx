import { Sparkles } from 'lucide-react'
import { CHANGELOG } from '@/data/changelog'

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

export default function WhatsNewPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 flex items-center gap-3">
        <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">What's New</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Fixes and improvements to the help desk.
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
                      <li key={item.title} className="flex gap-3">
                        <span
                          aria-hidden
                          className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            {item.title}
                          </p>
                          {item.body && (
                            <p className="mt-0.5 text-sm text-gray-600">
                              {item.body}
                            </p>
                          )}
                        </div>
                      </li>
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
