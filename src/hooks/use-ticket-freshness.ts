'use client'

import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { createClerkSupabaseClient } from '@/lib/supabase/client'
import { ticketKeys } from '@/hooks/use-tickets'

/**
 * How often to ask the server "has anything changed?".
 *
 * TanStack pauses `refetchInterval` while the tab is in the background
 * (`refetchIntervalInBackground` defaults to false), so an idle tab costs
 * nothing; the query's own `refetchOnWindowFocus` covers the moment the user
 * comes back.
 */
const POLL_MS = 30_000

/**
 * Key deliberately NOT under `ticketKeys.lists()` (`['tickets','list']`), so
 * invalidating the ticket lists never invalidates the probe that watches them.
 */
const freshnessKey = ['tickets', 'freshness'] as const

/**
 * A cheap, reliable "something changed" probe for the shared ticket list.
 *
 * WHY THIS EXISTS — measured 2026-09-22 from a Jerry sandbox against the
 * preview Supabase project, using this repo's own supabase-js client:
 *
 *   - A socket opened with the SERVICE ROLE key received an `UPDATE` on
 *     `tickets` within 8 s, so Realtime replication for that table is on and
 *     working at the database end.
 *   - A socket opened the way the BROWSER opens one — the public anon key,
 *     with the Clerk JWT only in `global.headers` — reported `SUBSCRIBED` and
 *     then received ZERO events for the same write. Supplying the token via
 *     `realtime.setAuth()` and via the `accessToken` option did not change
 *     that in the sandbox either (0 events in all three arrangements).
 *
 * So Realtime reports a healthy channel and silently delivers nothing to the
 * browser. Until this change that did not show, because the ticket list was
 * also refetched on every window focus and after a 30 s staleness window;
 * removing those (2026-09-08, to stop re-downloading 8.1 MB on every
 * navigation) took the covering refetch away and left the app with no working
 * refresh path at all. That is what "we have to manually refresh" is.
 *
 * WHAT THIS DOES INSTEAD: poll one 65-byte row — the newest `updated_at` the
 * signed-in user is allowed to see — and invalidate the heavy list only when
 * that value actually moves. Measured cost of the probe itself: 65 bytes,
 * ~270–470 ms warm (2026-09-22, same session as the numbers above), against
 * 8.1 MB / ~1.4 s for the list it guards.
 *
 * It is a safety net, not a replacement for Realtime: when Realtime does
 * deliver, the list is already fresh by the time the next probe lands and the
 * signature comparison below makes it a no-op.
 */
export function useTicketFreshness() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  const { data: signature } = useQuery<string>({
    queryKey: freshnessKey,
    staleTime: 0,
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
    // A failed probe must never surface to the user: the worst case is that
    // the list stays as fresh as it was before this hook existed.
    retry: 1,
    queryFn: async () => {
      const token = await getToken({ template: 'supabase' })
      if (!token) throw new Error('No auth token')

      const supabase = createClerkSupabaseClient(token)
      // RLS scopes this to tickets the caller can see, so "newest change"
      // means newest change *that is theirs to notice*. A ticket that becomes
      // visible to them (assigned, CC'd) has its `updated_at` touched by the
      // same write, so it shows up here too.
      const { data, error } = await supabase
        .from('tickets')
        .select('id, updated_at')
        .order('updated_at', { ascending: false })
        .limit(1)

      if (error) throw error

      const row = data?.[0] as { id?: string; updated_at?: string } | undefined
      return row ? `${row.id}:${row.updated_at}` : 'none'
    },
  })

  // Compare against the previous probe in a ref rather than state: this must
  // not re-render, and setState-inside-effect is what produced the tickets
  // layout's "Maximum update depth exceeded" crash (see
  // lib/views/department-views.ts).
  const lastSignature = useRef<string | null>(null)

  useEffect(() => {
    if (!signature) return

    // First reading establishes the baseline — it is not a change.
    if (lastSignature.current === null) {
      lastSignature.current = signature
      return
    }

    if (lastSignature.current === signature) return
    lastSignature.current = signature

    // Something moved. Refresh the lists, and the open ticket too: a reply
    // touches its parent ticket's `updated_at`, so this is also how a
    // conversation someone is reading picks up the other side's message.
    queryClient.invalidateQueries({ queryKey: ticketKeys.lists() })
    queryClient.invalidateQueries({ queryKey: ticketKeys.details() })
  }, [signature, queryClient])
}
