'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { createClerkSupabaseClient } from '@/lib/supabase/client'
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import type { PresenceUser } from '@/hooks/use-ticket-presence'

// ── Types ──────────────────────────────────────────────────────

interface GlobalPresencePayload {
  userId: string
  name: string
  avatarUrl?: string
  ticketId: string | null
}

// ── Hook ───────────────────────────────────────────────────────

/**
 * A lighter presence hook that tracks which tickets have agents viewing them.
 *
 * - Joins a single `global-ticket-presence` channel
 * - Each agent tracks which ticket they're currently viewing (or null)
 * - Returns a `Map<ticketId, PresenceUser[]>` of who's viewing what
 * - Only activates for agents/admins
 *
 * Call `setViewingTicket(ticketId)` when navigating to a ticket detail,
 * and `setViewingTicket(null)` when leaving.
 */
export function useGlobalPresence(
  currentUser: { id: string; name: string; avatar_url?: string; role: string } | null,
) {
  const { getToken } = useAuth()
  const [presenceMap, setPresenceMap] = useState<Map<string, PresenceUser[]>>(
    new Map(),
  )

  const clientRef = useRef<SupabaseClient | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const currentTicketRef = useRef<string | null>(null)

  const isAgentOrAdmin =
    currentUser?.role === 'agent' || currentUser?.role === 'admin'

  const setViewingTicket = useCallback(
    (ticketId: string | null) => {
      currentTicketRef.current = ticketId
      const channel = channelRef.current
      if (!channel || !currentUser) return
      channel.track({
        userId: currentUser.id,
        name: currentUser.name,
        avatarUrl: currentUser.avatar_url ?? '',
        ticketId,
      } satisfies GlobalPresencePayload)
    },
    [currentUser],
  )

  useEffect(() => {
    if (!currentUser || !isAgentOrAdmin) return

    let cancelled = false

    const setup = async () => {
      const token = await getToken({ template: 'supabase' })
      if (!token || cancelled) return

      const supabase = createClerkSupabaseClient(token)
      clientRef.current = supabase

      const channel = supabase.channel('global-ticket-presence', {
        config: { presence: { key: currentUser.id } },
      })

      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState<GlobalPresencePayload>()
          const map = new Map<string, PresenceUser[]>()

          for (const [key, presences] of Object.entries(state)) {
            if (key === currentUser.id) continue
            const latest = presences[presences.length - 1]
            if (!latest?.ticketId) continue

            const existing = map.get(latest.ticketId) ?? []
            existing.push({
              userId: latest.userId,
              name: latest.name,
              avatarUrl: latest.avatarUrl || undefined,
              isTyping: false,
            })
            map.set(latest.ticketId, existing)
          }

          setPresenceMap(map)
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED' && !cancelled) {
            await channel.track({
              userId: currentUser.id,
              name: currentUser.name,
              avatarUrl: currentUser.avatar_url ?? '',
              ticketId: currentTicketRef.current,
            } satisfies GlobalPresencePayload)
          }
        })

      channelRef.current = channel
    }

    setup()

    return () => {
      cancelled = true
      if (channelRef.current && clientRef.current) {
        clientRef.current.removeChannel(channelRef.current)
        channelRef.current = null
      }
      setPresenceMap(new Map())
    }
  }, [currentUser?.id, isAgentOrAdmin, getToken])

  return { presenceMap, setViewingTicket }
}
