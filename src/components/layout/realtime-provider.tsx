'use client'

import { useRealtimeTickets } from '@/hooks/use-realtime-tickets'

/**
 * Wrapper component that activates Supabase Realtime subscriptions for the
 * portal. Drop this inside the portal layout so every child route benefits
 * from live cache invalidation without needing to subscribe individually.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  useRealtimeTickets()
  return <>{children}</>
}
