import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createThrottledRunner } from '@/lib/realtime/throttle'

describe('createThrottledRunner', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('runs the first call immediately', () => {
    const fn = vi.fn()
    createThrottledRunner(fn, 10_000).run()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('collapses a burst into the leading call plus one trailing call', () => {
    const fn = vi.fn()
    const r = createThrottledRunner(fn, 10_000)

    // 40 ticket changes land in the same second.
    for (let i = 0; i < 40; i++) r.run()
    expect(fn).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(10_000)
    expect(fn).toHaveBeenCalledTimes(2)

    // Nothing further arrived, so the runner goes quiet.
    vi.advanceTimersByTime(60_000)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('caps a continuous stream at one run per window', () => {
    const fn = vi.fn()
    const r = createThrottledRunner(fn, 10_000)

    // One event per second for a minute.
    for (let i = 0; i < 60; i++) {
      r.run()
      vi.advanceTimersByTime(1_000)
    }
    // Leading run + one per 10s window, rather than 60 full reloads.
    expect(fn.mock.calls.length).toBeLessThanOrEqual(7)
    expect(fn.mock.calls.length).toBeGreaterThan(1)
  })

  it('runs immediately again once a quiet window has passed', () => {
    const fn = vi.fn()
    const r = createThrottledRunner(fn, 10_000)
    r.run()
    vi.advanceTimersByTime(10_000)
    r.run()
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('cancel drops a queued trailing run', () => {
    const fn = vi.fn()
    const r = createThrottledRunner(fn, 10_000)
    r.run()
    r.run()
    r.cancel()
    vi.advanceTimersByTime(60_000)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('still works after cancel, so a remount does not kill live updates', () => {
    // Regression guard: an earlier version latched a `cancelled` flag, which
    // meant the first effect cleanup (StrictMode remount in development, or
    // any dependency change in production) silently stopped every later
    // ticket refresh for the rest of the session.
    const fn = vi.fn()
    const r = createThrottledRunner(fn, 10_000)
    r.run()
    r.cancel()
    r.run()
    expect(fn).toHaveBeenCalledTimes(2)
  })
})
