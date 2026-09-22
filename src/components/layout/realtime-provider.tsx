'use client'

import { useRealtimeTickets } from '@/hooks/use-realtime-tickets'
import { useTicketFreshness } from '@/hooks/use-ticket-freshness'

/**
 * Wrapper component that activates Supabase Realtime subscriptions for the
 * portal. Drop this inside the portal layout so every child route benefits
 * from live cache invalidation without needing to subscribe individually.
 *
 * `useTicketFreshness` sits alongside it as the safety net: Realtime reports
 * a healthy channel in the browser but was measured delivering no ticket
 * events (see that hook's comment), so liveness must not depend on it alone.
 * When Realtime does work the probe costs 65 bytes every 30 s and finds
 * nothing to do.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  useRealtimeTickets()
  useTicketFreshness()
  return <>{children}</>
}
