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
  }, [getToken, queryClient, refreshTicketLists])

  useEffect(() => {
    setup()

    return () => {
      // Tear down the channel and mark disconnected
      if (channelRef.current) {
        clientRef.current?.removeChannel(channelRef.current)
        channelRef.current = null
      }
      // Drop any queued list refresh so it can't fire into an unmounted tree.
      refreshTicketLists.cancel()
      setIsConnected(false)
    }
  }, [setup, refreshTicketLists])

  return { isConnected }
}
