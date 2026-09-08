import { describe, it, expect } from 'vitest'
import { getPageWindow, DEFAULT_PAGE_SIZE } from '@/lib/pagination/paginate'

describe('getPageWindow', () => {
  it('slices the first page of a long list', () => {
    const w = getPageWindow(4189, 1)
    expect(w).toMatchObject({ page: 1, start: 0, end: 50, from: 1, to: 50 })
    expect(w.pageCount).toBe(84)
  })

  it('slices a middle page', () => {
    const w = getPageWindow(4189, 3)
    expect(w).toMatchObject({ page: 3, start: 100, end: 150, from: 101, to: 150 })
  })

  it('does not run past the end on the last page', () => {
    // 4189 = 83 full pages + 39 rows.
    const w = getPageWindow(4189, 84)
    expect(w).toMatchObject({ page: 84, start: 4150, end: 4189, to: 4189 })
    expect(w.end - w.start).toBe(39)
  })

  it('clamps a page number left over from a wider result set', () => {
    // The user was on page 40, then typed a search that matches 3 tickets.
    // Showing them an empty table is the bug this guards.
    const w = getPageWindow(3, 40)
    expect(w).toMatchObject({ page: 1, pageCount: 1, start: 0, end: 3, from: 1, to: 3 })
  })

  it('survives an empty result set', () => {
    const w = getPageWindow(0, 1)
    expect(w).toMatchObject({ page: 1, pageCount: 1, start: 0, end: 0, from: 0, to: 0 })
  })

  it('rejects nonsense page numbers instead of producing a bad slice', () => {
    for (const bad of [0, -5, Number.NaN, 1.7]) {
      const w = getPageWindow(120, bad)
      expect(w.page).toBeGreaterThanOrEqual(1)
      expect(w.start).toBeGreaterThanOrEqual(0)
      expect(w.end).toBeLessThanOrEqual(120)
      expect(w.end).toBeGreaterThanOrEqual(w.start)
    }
  })

  it('falls back to the default size when handed a nonsense page size', () => {
    expect(getPageWindow(100, 1, 0).end).toBe(DEFAULT_PAGE_SIZE)
    expect(getPageWindow(100, 1, -10).end).toBe(DEFAULT_PAGE_SIZE)
  })

  it('never drops or duplicates a row across all pages', () => {
    const rows = Array.from({ length: 237 }, (_, i) => i)
    const seen: number[] = []
    const { pageCount } = getPageWindow(rows.length, 1)
    for (let p = 1; p <= pageCount; p++) {
      const w = getPageWindow(rows.length, p)
      seen.push(...rows.slice(w.start, w.end))
    }
    expect(seen).toEqual(rows)
  })
})
