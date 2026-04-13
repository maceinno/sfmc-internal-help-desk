'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useQueryClient } from '@tanstack/react-query'
import { createClerkSupabaseClient } from '@/lib/supabase/client'
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'

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
          queryClient.invalidateQueries({ queryKey: ['tickets'] })
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tickets' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['tickets'] })
          const ticketId = (payload.new as { id?: string })?.id
          if (ticketId) {
            queryClient.invalidateQueries({ queryKey: ['tickets', 'detail', ticketId] })
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'tickets' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['tickets'] })
          const ticketId = (payload.old as { id?: string })?.id
          if (ticketId) {
            queryClient.invalidateQueries({ queryKey: ['tickets', 'detail', ticketId] })
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
            queryClient.invalidateQueries({ queryKey: ['tickets', 'detail', ticketId] })
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
  }, [getToken, queryClient])

  useEffect(() => {
    setup()

    return () => {
      // Tear down the channel and mark disconnected
      if (channelRef.current) {
        clientRef.current?.removeChannel(channelRef.current)
        channelRef.current = null
      }
      setIsConnected(false)
    }
  }, [setup])

  return { isConnected }
}
