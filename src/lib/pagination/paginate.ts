/**
 * Paging maths for long lists.
 *
 * Kept as a pure function (rather than inline in a component) for two
 * reasons: the clamping rules are the part that actually breaks — a page
 * number left over from a wider result set must not show an empty table —
 * and it is the only part worth unit-testing.
 *
 * Why this exists at all: measured against live preview data on 2026-09-08
 * the agent ticket list rendered all 4,189 tickets in a single table, nine
 * columns each, i.e. ~37,700 cells with an SLA countdown recomputed per row.
 * That is what locked up the browser tab.
 */

/** Rows per page in the agent ticket list. */
export const DEFAULT_PAGE_SIZE = 50

export interface PageWindow {
  /** 1-based page, clamped into the available range. */
  page: number
  /** Total pages; always at least 1 so the pager has something to show. */
  pageCount: number
  /** 0-based slice start. */
  start: number
  /** 0-based slice end, exclusive. */
  end: number
  /** 1-based index of the first row shown; 0 when there are no rows. */
  from: number
  /** 1-based index of the last row shown; 0 when there are no rows. */
  to: number
}

/**
 * Resolve a requested page against a result count.
 *
 * `requestedPage` is deliberately forgiving: it may be out of range (a
 * filter narrowed the results after the user paged forward), zero, negative
 * or NaN, and the returned window is always valid.
 */
export function getPageWindow(
  total: number,
  requestedPage: number,
  pageSize: number = DEFAULT_PAGE_SIZE,
): PageWindow {
  const safeTotal = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0
  const safeSize =
    Number.isFinite(pageSize) && pageSize > 0
      ? Math.floor(pageSize)
      : DEFAULT_PAGE_SIZE

  const pageCount = Math.max(1, Math.ceil(safeTotal / safeSize))
  const page = Number.isFinite(requestedPage)
    ? Math.min(Math.max(Math.floor(requestedPage), 1), pageCount)
    : 1

  const start = (page - 1) * safeSize
  const end = Math.min(start + safeSize, safeTotal)

  return {
    page,
    pageCount,
    start,
    end,
    from: safeTotal === 0 ? 0 : start + 1,
    to: end,
  }
}
