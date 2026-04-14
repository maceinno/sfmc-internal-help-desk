'use client'

import { useMemo } from 'react'
import { Globe, Loader2, ShieldAlert } from 'lucide-react'
import { useTickets } from '@/hooks/use-tickets'
import { useUsers } from '@/hooks/use-users'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useRegions } from '@/hooks/use-admin-config'
import { filterRegionTickets } from '@/lib/permissions/policies'
import { TicketList } from '@/components/tickets/ticket-list'

export default function RegionPage() {
  const { profile, isLoading: userLoading } = useCurrentUser()
  const { data: tickets = [], isLoading: ticketsLoading } = useTickets()
  const { data: users = [], isLoading: usersLoading } = useUsers()
  const { data: regions = [], isLoading: regionsLoading } = useRegions()

  const regionName = useMemo(() => {
    if (!profile?.managed_region_id || regions.length === 0) return null
    const region = regions.find((r) => r.id === profile.managed_region_id)
    return region?.name ?? null
  }, [profile?.managed_region_id, regions])

  const regionTickets = useMemo(() => {
    if (!profile) return []
    return filterRegionTickets(profile, tickets, users)
  }, [profile, tickets, users])

  const isLoading = userLoading || ticketsLoading || usersLoading || regionsLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    )
  }

  if (!profile?.has_regional_access || !profile?.managed_region_id) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-7 h-7 text-red-500" />
          <h1 className="text-2xl font-bold text-gray-900">Unauthorized</h1>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
          You do not have regional manager access. Contact an administrator if
          you believe this is an error.
        </div>
      </div>
    )
  }

  return (
    <div className="-m-4 lg:-m-8 flex h-[calc(100vh-4rem)] lg:h-screen overflow-hidden">
      <div className="flex-1 overflow-hidden">
        <TicketList
          tickets={regionTickets}
          title={`My Region: ${regionName ?? 'Unknown'}`}
          users={users}
        />
      </div>
    </div>
  )
}
