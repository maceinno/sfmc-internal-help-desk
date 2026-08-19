// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { withNewDepartmentsCollapsed } from '@/lib/views/department-views'

/**
 * Regression cover for the "Maximum update depth exceeded" crash on the
 * tickets page (seen 2026-08-19).
 *
 * The tickets layout runs this from a useEffect whose dependency is rebuilt
 * on every render while the department query has no data. The old version
 * returned a fresh object every time, so React saw a state change on each
 * run, re-rendered, re-ran the effect, and looped until it aborted and the
 * page went blank.
 *
 * The load-bearing assertion here is `toBe` — same object identity, not just
 * equal contents. `toEqual` would pass against the broken version.
 */
describe('withNewDepartmentsCollapsed', () => {
  it('returns the SAME object when there is nothing new to add', () => {
    const prev = { Other: true, 'IT Support': true }
    const result = withNewDepartmentsCollapsed(prev, ['IT Support'])
    expect(result).toBe(prev)
  })

  it('returns the SAME object for an empty department list', () => {
    // This is the exact case during loading, when the effect fires on every
    // render — it must not produce a state update.
    const prev = { Other: true }
    expect(withNewDepartmentsCollapsed(prev, [])).toBe(prev)
  })

  it('stays stable when called repeatedly with a new-but-equal array', () => {
    // Mimics the render loop: a fresh array instance each time, same contents.
    let state: Record<string, boolean> = { Other: true }
    for (let i = 0; i < 100; i++) {
      const next = withNewDepartmentsCollapsed(state, ['IT Support', 'Lending Support'])
      if (i > 0) expect(next).toBe(state)
      state = next
    }
    expect(state).toEqual({
      Other: true,
      'IT Support': true,
      'Lending Support': true,
    })
  })

  it('adds a newly-appearing department, collapsed', () => {
    const prev = { Other: true }
    const result = withNewDepartmentsCollapsed(prev, ['Payoff Request'])
    expect(result).not.toBe(prev)
    expect(result).toEqual({ Other: true, 'Payoff Request': true })
  })

  it('never re-collapses a group the user has opened', () => {
    // 'IT Support' is false because someone expanded it. Adding an unrelated
    // department must not reset that.
    const prev = { Other: true, 'IT Support': false }
    const result = withNewDepartmentsCollapsed(prev, [
      'IT Support',
      'Marketing Support',
    ])
    expect(result['IT Support']).toBe(false)
    expect(result['Marketing Support']).toBe(true)
  })

  it('does not mutate the object it was given', () => {
    const prev = { Other: true }
    withNewDepartmentsCollapsed(prev, ['Closing Support'])
    expect(prev).toEqual({ Other: true })
  })
})
