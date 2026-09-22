'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useQueryClient } from '@tanstack/react-query'
import { createClerkSupabaseClient } from '@/lib/supabase/client'
import { createThrottledRunner } from '@/lib/realtime/throttle'
import { ticketKeys } from '@/hooks/use-tickets'
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'

/**
 * Shortest gap between two refreshes of the shared ticket list.
 *
 * The first change in a burst still refreshes immediately; this only caps
 * how often a *stream* of changes can trigger the 8.1 MB list reload. See
 * lib/realtime/throttle.ts.
 */
const TICKET_LIST_REFRESH_MS = 10_000

/** How often to hand the Realtime socket a freshly minted Clerk token. */
const TOKEN_REFRESH_MS = 45_000

/**
 * Subscribe to Supabase Realtime for live ticket, message, and notification
 * updates. On every postgres_changes event the relevant TanStack Query cache
 * keys are automatically invalidated so the UI stays fresh without polling.
 *
 * Call this hook once in the portal layout (via `<RealtimeProvider>`).
 */
export function useRealtimeTickets() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  const [isConnected, setIsConnected] = useState(false)

  // Keep mutable refs so the cleanup function always has the latest handles
  const clientRef = useRef<SupabaseClient | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  // Clerk session tokens are short-lived (a minute or so). The socket holds
  // one for as long as the tab is open, so it has to be handed a fresh one
  // or it silently ages out of its own subscription part-way through a shift.
  const tokenRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Ticket-LIST refreshes are throttled; ticket-DETAIL refreshes below are
  // not, because the ticket you are reading has to update instantly and that
  // query is a single row.
  //
  // Note the narrower key than before: invalidating the whole ['tickets']
  // prefix also threw away every open ticket's detail cache and any
  // in-flight reply-search results on each unrelated change elsewhere.
  const refreshTicketLists = useMemo(
    () =>
      createThrottledRunner(() => {
        queryClient.invalidateQueries({ queryKey: ticketKeys.lists() })
      }, TICKET_LIST_REFRESH_MS),
    [queryClient],
  )

  const setup = useCallback(async () => {
    // Obtain a Clerk-signed JWT for Supabase
    const token = await getToken({ template: 'supabase' })
    if (!token) return

    const supabase = createClerkSupabaseClient(token)
    clientRef.current = supabase

    // `createClerkSupabaseClient` puts the Clerk JWT in `global.headers`,
    // which only reaches PostgREST. The Realtime socket authenticates
    // separately and, without the line below, connects carrying nothing but
    // the public anon key — no `profile_id`, no `sub` — so RLS
    // (`can_see_ticket`) filters every row out and the channel reports
    // SUBSCRIBED while delivering nothing.
    //
    // HONEST LIMIT: this is the right shape and the socket plainly needs an
    // identity, but it is NOT verified to restore delivery. Measured
    // 2026-09-22 from a Jerry sandbox, an anon-key socket received zero
    // `tickets` events with `setAuth`, with the `accessToken` option, and
    // with nothing — while a service-role socket received them. A real Clerk
    // user JWT cannot be minted in that sandbox, so the browser case is
    // unverified from here. `useTicketFreshness` is what actually guarantees
    // the list refreshes; treat this as removing a known defect, not as the
    // fix for it.
    await supabase.realtime.setAuth(token)

    const channel = supabase
      .channel('portal-realtime')
      // ── Tickets table ───────────────────────────────────────────
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tickets' },
        () => {
          refreshTicketLists.run()
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tickets' },
        (payload) => {
          refreshTicketLists.run()
          const ticketId = (payload.new as { id?: string })?.id
          if (ticketId) {
            queryClient.invalidateQueries({ queryKey: ticketKeys.detail(ticketId) })
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'tickets' },
        (payload) => {
          refreshTicketLists.run()
          const ticketId = (payload.old as { id?: string })?.id
          if (ticketId) {
            queryClient.invalidateQueries({ queryKey: ticketKeys.detail(ticketId) })
          }
        },
      )
      // ── Messages table ──────────────────────────────────────────
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const ticketId = (payload.new as { ticket_id?: string })?.ticket_id
          if (ticketId) {
            queryClient.invalidateQueries({ queryKey: ticketKeys.detail(ticketId) })
          }
        },
      )
      // ── Notifications table ─────────────────────────────────────
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications'] })
        },
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED')
      })

    channelRef.current = channel

    // Keep the socket's token fresh for the life of the tab.
    if (tokenRefreshRef.current) clearInterval(tokenRefreshRef.current)
    tokenRefreshRef.current = setInterval(async () => {
      try {
        const fresh = await getToken({ template: 'supabase' })
        if (fresh) await supabase.realtime.setAuth(fresh)
      } catch {
        // A failed refresh is not worth surfacing: the freshness probe in
        // useTicketFreshness still keeps the lists up to date.
      }
    }, TOKEN_REFRESH_MS)
  }, [getToken, queryClient, refreshTicketLists])

  useEffect(() => {
    setup()

    return () => {
      // Tear down the channel and mark disconnected
      if (channelRef.current) {
        clientRef.current?.removeChannel(channelRef.current)
        channelRef.current = null
      }
      if (tokenRefreshRef.current) {
        clearInterval(tokenRefreshRef.current)
        tokenRefreshRef.current = null
      }
      // Drop any queued list refresh so it can't fire into an unmounted tree.
      refreshTicketLists.cancel()
      setIsConnected(false)
    }
  }, [setup, refreshTicketLists])

  return { isConnected }
}
