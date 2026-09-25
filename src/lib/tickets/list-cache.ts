import type { Ticket } from '@/types/ticket'

/**
 * Pure helpers for editing the cached shared ticket list in place.
 *
 * WHY THIS EXISTS — measured 2026-09-25 from a Jerry sandbox against the
 * preview Supabase project (service-role client, the exact `useTickets()`
 * projection): the full list is now 4,716 tickets / 9.6 MB of JSON and took
 * 1.7 s on one run and 5.5 s on the next. That is WITHOUT row-level security;
 * a signed-in user's request also runs RLS on every ticket and every embedded
 * message, which is not measurable from the sandbox. Every refresh used to be
 * "throw the list away and download all of it again", so a solved ticket sat
 * in the agent's view until that download finished — or, if it did not
 * finish, until they reloaded the page.
 *
 * Instead the list is now edited in place:
 *   - `patchTicketInList` applies the agent's own change the moment the
 *     database confirms it (a solved ticket leaves the view instantly);
 *   - `mergeChangedTickets` folds in only the tickets that changed since the
 *     newest one already held (measured: 11 tickets changed in the last hour,
 *     a 5-minute delta query took 135 ms).
 */

/** Newest `updated_at` in the list, or null when the list is empty. */
export function latestUpdatedAt(list: readonly Ticket[]): string | null {
  let latest: string | null = null
  let latestMs = -Infinity
  for (const t of list) {
    if (!t.updated_at) continue
    const ms = Date.parse(t.updated_at)
    if (Number.isNaN(ms)) continue
    if (ms > latestMs) {
      latestMs = ms
      latest = t.updated_at
    }
  }
  return latest
}

/**
 * Overlay a ticket row's own columns onto the cached copy of that ticket.
 *
 * `patch` is usually the row the database returned from an update — plain
 * ticket columns only, no `messages` / `cc` / `collaborators` /
 * `custom_fields`. Those embedded arrays are kept from the cached copy, so an
 * update never blanks the SLA's message history or the CC list. Returns the
 * same array when the ticket is not in it, so React Query sees no change.
 */
export function patchTicketInList(
  list: readonly Ticket[],
  id: string,
  patch: Partial<Ticket>,
): Ticket[] {
  const index = list.findIndex((t) => t.id === id)
  if (index === -1) return list as Ticket[]

  const current = list[index]
  const next: Ticket = { ...current }
  for (const [key, value] of Object.entries(patch)) {
    // A plain update response never carries the embedded arrays; if one ever
    // arrives undefined, keep what we have rather than erasing it.
    if (value === undefined) continue
    ;(next as unknown as Record<string, unknown>)[key] = value
  }

  const copy = list.slice()
  copy[index] = next
  return copy
}

/**
 * Fold freshly fetched tickets (full list shape) into the cached list:
 * replace a ticket that is already there, add one that is new, and keep the
 * list's own order (newest `created_at` first — the order `useTickets()`
 * asks the database for).
 */
export function mergeChangedTickets(
  list: readonly Ticket[],
  changed: readonly Ticket[],
): Ticket[] {
  if (changed.length === 0) return list as Ticket[]

  const byId = new Map(changed.map((t) => [t.id, t]))
  const merged: Ticket[] = []
  for (const t of list) {
    const replacement = byId.get(t.id)
    if (replacement) {
      merged.push(replacement)
      byId.delete(t.id)
    } else {
      merged.push(t)
    }
  }
  if (byId.size === 0) return merged

  // New tickets: add them and restore created_at-descending order. Only done
  // when something was actually added, so a pure update keeps positions.
  merged.push(...byId.values())
  return merged.sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
  )
}
