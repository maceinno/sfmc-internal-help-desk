'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { createClerkSupabaseClient } from '@/lib/supabase/client'
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'

// ── Types ──────────────────────────────────────────────────────

export interface PresenceUser {
  userId: string
  name: string
  avatarUrl?: string
  isTyping: boolean
}

interface PresencePayload {
  userId: string
  name: string
  avatarUrl?: string
  isTyping: boolean
}

// ── Hook ───────────────────────────────────────────────────────

/**
 * Manages Supabase Presence for a specific ticket detail page.
 *
 * - Joins channel `ticket-presence:<ticketId>` when mounted
 * - Tracks the current user with `{ userId, name, avatarUrl, isTyping }`
 * - Listens for `sync` events to build a list of other viewers
 * - Provides `setIsTyping(boolean)` to update typing state
 * - Cleans up the channel on unmount
 * - Only activates for agents/admins (employees are excluded)
 *
 * @returns `{ viewers, setIsTyping }` where `viewers` excludes the current user
 */
export function useTicketPresence(
  ticketId: string | undefined,
  currentUser: { id: string; name: string; avatar_url?: string; role: string } | null,
) {
  const { getToken } = useAuth()
  const [viewers, setViewers] = useState<PresenceUser[]>([])

  const clientRef = useRef<SupabaseClient | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const isTypingRef = useRef(false)

  const isAgentOrAdmin =
    currentUser?.role === 'agent' || currentUser?.role === 'admin'

  // ── setIsTyping ────────────────────────────────────────────
  const setIsTyping = useCallback(
    (typing: boolean) => {
      isTypingRef.current = typing
      const channel = channelRef.current
      if (!channel || !currentUser) return
      channel.track({
        userId: currentUser.id,
        name: currentUser.name,
        avatarUrl: currentUser.avatar_url ?? '',
        isTyping: typing,
      } satisfies PresencePayload)
    },
    [currentUser],
  )

  // ── Channel lifecycle ──────────────────────────────────────
  useEffect(() => {
    if (!ticketId || !currentUser || !isAgentOrAdmin) return

    let cancelled = false

    const setup = async () => {
      const token = await getToken({ template: 'supabase' })
      if (!token || cancelled) return

      const supabase = createClerkSupabaseClient(token)
      clientRef.current = supabase

      const channel = supabase.channel(`ticket-presence:${ticketId}`, {
        config: { presence: { key: currentUser.id } },
      })

      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState<PresencePayload>()
          const others: PresenceUser[] = []
          for (const [key, presences] of Object.entries(state)) {
            if (key === currentUser.id) continue
            const latest = presences[presences.length - 1]
            if (latest) {
              others.push({
                userId: latest.userId,
                name: latest.name,
                avatarUrl: latest.avatarUrl || undefined,
                isTyping: latest.isTyping ?? false,
              })
            }
          }
          setViewers(others)
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED' && !cancelled) {
            await channel.track({
              userId: currentUser.id,
              name: currentUser.name,
              avatarUrl: currentUser.avatar_url ?? '',
              isTyping: false,
            } satisfies PresencePayload)
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
      setViewers([])
    }
  }, [ticketId, currentUser?.id, isAgentOrAdmin, getToken])

  return { viewers, setIsTyping }
}
