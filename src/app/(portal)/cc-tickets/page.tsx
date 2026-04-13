'use client'

import { useMemo } from 'react'
import { Loader2, Users } from 'lucide-react'
import { useTickets } from '@/hooks/use-tickets'
import { useUsers } from '@/hooks/use-users'
import { useCurrentUser } from '@/hooks/use-current-user'
import { TicketList } from '@/components/tickets/ticket-list'

export default function CcTicketsPage() {
  const { profile, isLoading: userLoading } = useCurrentUser()
  const { data: tickets = [], isLoading: ticketsLoading } = useTickets()
  const { data: users = [], isLoading: usersLoading } = useUsers()

  const ccTickets = useMemo(() => {
    if (!profile?.id) return []
    return tickets.filter((t) => t.cc?.includes(profile.id))
  }, [tickets, profile?.id])

  const isLoading = userLoading || ticketsLoading || usersLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    )
  }

  if (ccTickets.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Users className="w-7 h-7 text-gray-700" />
          <h1 className="text-2xl font-bold text-gray-900">CC'd Tickets</h1>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
          You are not CC'd on any tickets.
        </div>
      </div>
    )
  }

  return (
    <div className="-m-4 lg:-m-8 flex h-[calc(100vh-4rem)] lg:h-screen overflow-hidden">
      <div className="flex-1 overflow-hidden">
        <TicketList
          tickets={ccTickets}
          title="CC'd Tickets"
          users={users}
        />
      </div>
    </div>
  )
}
