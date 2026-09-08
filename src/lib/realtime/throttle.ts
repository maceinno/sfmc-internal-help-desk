/**
 * Collapse a burst of calls into one immediate call plus at most one
 * follow-up per window ("leading + trailing throttle").
 *
 * Written for Realtime ticket events. Every INSERT/UPDATE/DELETE on
 * `tickets` used to invalidate the shared ticket list, and that list is an
 * 8.1 MB / 4,189-row payload (measured against live preview data on
 * 2026-09-08) which every open browser then re-downloads, re-parses and
 * re-renders. On a busy help desk — 180 user accounts, bulk imports, an
 * agent triaging a queue — that arrives as a steady stream, so the app spent
 * its time refetching rather than responding.
 *
 * Leading edge fires immediately on purpose: a single change (someone
 * assigns a ticket to you) must still show up at once. Only a *burst* is
 * collapsed, and the trailing call guarantees the last change in a burst is
 * never dropped.
 */
export interface ThrottledRunner {
  /** Request a run. */
  run(): void
  /**
   * Drop any queued trailing run and close the window.
   *
   * Deliberately NOT a permanent kill switch: this is called from effect
   * cleanup, and React remounts components (StrictMode in development, and
   * any effect whose dependencies change in production). A latched
   * "cancelled" flag here would silently stop live updates for the rest of
   * the session after the first remount. Calling `run()` after `cancel()`
   * is expected and works.
   */
  cancel(): void
}

export function createThrottledRunner(
  fn: () => void,
  waitMs: number,
): ThrottledRunner {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending = false

  const openWindow = () => {
    timer = setTimeout(() => {
      timer = null
      if (pending) {
        pending = false
        fn()
        // A trailing run starts a fresh window, so a continuous stream of
        // events settles into one run per `waitMs` rather than two.
        openWindow()
      }
    }, waitMs)
  }

  return {
    run() {
      if (timer) {
        // Inside an open window — remember that something happened and let
        // the trailing run pick it up.
        pending = true
        return
      }
      fn()
      openWindow()
    },
    cancel() {
      pending = false
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
    },
  }
}
