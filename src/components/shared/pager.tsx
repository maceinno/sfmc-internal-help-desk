'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { PageWindow } from '@/lib/pagination/paginate'

interface PagerProps {
  /** Resolved window from getPageWindow — already clamped. */
  window: PageWindow
  /** Total rows across every page (not just the ones on screen). */
  total: number
  /** Singular noun for the rows, e.g. "ticket". */
  itemLabel?: string
  onPageChange: (page: number) => void
}

/**
 * "Showing 1–50 of 4,189" plus Previous / Next.
 *
 * Styling deliberately mirrors the ticket filter bar above the table
 * (same gray-50 strip, same border, same control height on desktop) so the
 * table looks bracketed rather than bolted together. On a phone the buttons
 * grow to a 44px tap target; on desktop they match the h-8 filter controls.
 */
export function Pager({
  window,
  total,
  itemLabel = 'ticket',
  onPageChange,
}: PagerProps) {
  const { page, pageCount, from, to } = window

  // A single page of results needs no controls at all.
  if (pageCount <= 1) return null

  const atStart = page <= 1
  const atEnd = page >= pageCount

  const buttonClass =
    'inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 h-11 sm:h-8 text-sm text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400'

  return (
    <div
      data-print="hide"
      className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 bg-gray-50/50 px-6 py-2"
    >
      <p className="text-sm text-gray-600">
        Showing{' '}
        <span className="font-medium text-gray-900">
          {from.toLocaleString()}–{to.toLocaleString()}
        </span>{' '}
        of{' '}
        <span className="font-medium text-gray-900">
          {total.toLocaleString()}
        </span>{' '}
        {itemLabel}
        {total === 1 ? '' : 's'}
      </p>

      <div className="flex items-center gap-2">
        <span className="hidden text-sm text-gray-500 sm:inline">
          Page {page.toLocaleString()} of {pageCount.toLocaleString()}
        </span>
        <button
          type="button"
          className={buttonClass}
          onClick={() => onPageChange(page - 1)}
          disabled={atStart}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </button>
        <button
          type="button"
          className={buttonClass}
          onClick={() => onPageChange(page + 1)}
          disabled={atEnd}
          aria-label="Next page"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
