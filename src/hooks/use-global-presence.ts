'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { createClerkSupabaseClient } from '@/lib/supabase/client'
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { useUIStore } from '@/stores/ui-store'
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
 * Tracks which tickets have agents viewing them across the whole portal.
 *
 * - Joins a single `global-ticket-presence` channel
 * - Broadcasts the current user's `activeTicketId` (read from the UI store,
 *   set by the ticket detail page on mount) so other agents see who's
 *   on which ticket
 * - Returns a `Map<ticketId, PresenceUser[]>` of who's viewing what,
 *   used by TicketTable to show eye icons next to ticket IDs
 * - Only activates for agents/admins; employees skip the subscription
 */
export function useGlobalPresence(
  currentUser: { id: string; name: string; avatar_url?: string; role: string } | null,
) {
  const { getToken } = useAuth()
  const [presenceMap, setPresenceMap] = useState<Map<string, PresenceUser[]>>(
    new Map(),
  )
  const activeTicketId = useUIStore((s) => s.activeTicketId)

  const clientRef = useRef<SupabaseClient | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  // Mirror the store value into a ref so the SUBSCRIBED callback below can
  // pick up the freshest value without re-subscribing every navigation.
  const activeTicketIdRef = useRef<string | null>(activeTicketId)

  const isAgentOrAdmin =
    currentUser?.role === 'agent' || currentUser?.role === 'admin'

  // ── Channel lifecycle ──────────────────────────────────────
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
              ticketId: activeTicketIdRef.current,
            } satisfies GlobalPresencePayload)
          }
        })

      channelRef.current = channel
    }

    setup()

    return () => {
      cancelled = true
      if (clientRef.current) {
        clientRef.current.removeAllChannels()
        clientRef.current = null
      }
      channelRef.current = null
      setPresenceMap(new Map())
    }
  }, [currentUser?.id, isAgentOrAdmin, getToken])

  // ── Re-broadcast when active ticket changes ────────────────
  useEffect(() => {
    activeTicketIdRef.current = activeTicketId
    const channel = channelRef.current
    if (!channel || !currentUser || !isAgentOrAdmin) return
    void channel.track({
      userId: currentUser.id,
      name: currentUser.name,
      avatarUrl: currentUser.avatar_url ?? '',
      ticketId: activeTicketId,
    } satisfies GlobalPresencePayload)
  }, [activeTicketId, currentUser, isAgentOrAdmin])

  return { presenceMap }
}
