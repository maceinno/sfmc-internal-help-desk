'use client'

import { useMemo, useState } from 'react'
import { Loader2, Ticket } from 'lucide-react'
import { useTickets } from '@/hooks/use-tickets'
import { useUsers } from '@/hooks/use-users'
import { useCurrentUser } from '@/hooks/use-current-user'
import { TicketList } from '@/components/tickets/ticket-list'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

export default function MyTicketsPage() {
  const {
    profile,
    isAgent,
    isAdmin,
    isLoading: userLoading,
  } = useCurrentUser()
  const { data: tickets = [], isLoading: ticketsLoading } = useTickets()
  const { data: users = [], isLoading: usersLoading } = useUsers()

  const isAgentOrAdmin = isAgent || isAdmin
  const [activeTab, setActiveTab] = useState<'created' | 'assigned'>('created')

  const createdByMe = useMemo(() => {
    if (!profile?.id) return []
    return tickets.filter((t) => t.created_by === profile.id)
  }, [tickets, profile?.id])

  const assignedToMe = useMemo(() => {
    if (!profile?.id) return []
    return tickets.filter((t) => t.assigned_to === profile.id)
  }, [tickets, profile?.id])

  const isLoading = userLoading || ticketsLoading || usersLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    )
  }

  // Employees only see tickets they created — they don't take or get
  // assigned tickets, so no second tab.
  if (!isAgentOrAdmin) {
    if (createdByMe.length === 0) {
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Ticket className="w-7 h-7 text-gray-700" />
            <h1 className="text-2xl font-bold text-gray-900">My Tickets</h1>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
            You haven&apos;t created any tickets yet.
          </div>
        </div>
      )
    }
    return (
      <div className="-m-4 lg:-m-8 flex h-[calc(100vh-4rem)] lg:h-screen overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <TicketList tickets={createdByMe} title="My Tickets" users={users} />
        </div>
      </div>
    )
  }

  // Agents and admins get two grids: tickets they raised + tickets
  // taken / assigned to them.
  return (
    <div className="-m-4 lg:-m-8 flex h-[calc(100vh-4rem)] flex-col overflow-hidden lg:h-screen">
      <Tabs
        value={activeTab}
        onValueChange={(v) =>
          setActiveTab((v as 'created' | 'assigned') ?? 'created')
        }
        className="flex flex-1 flex-col overflow-hidden"
      >
        <div className="flex-shrink-0 border-b border-gray-200 bg-white px-6 py-3">
          <TabsList variant="line" className="gap-4">
            <TabsTrigger value="created" className="px-2">
              My Tickets (Created)
              <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                {createdByMe.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="assigned" className="px-2">
              Assigned to Me
              <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                {assignedToMe.length}
              </span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="created"
          className="flex-1 overflow-hidden data-[state=inactive]:hidden"
        >
          {createdByMe.length === 0 ? (
            <div className="flex h-full items-center justify-center bg-white p-12 text-center text-gray-500">
              You haven&apos;t created any tickets yet.
            </div>
          ) : (
            <TicketList
              tickets={createdByMe}
              title="My Tickets (Created)"
              users={users}
            />
          )}
        </TabsContent>

        <TabsContent
          value="assigned"
          className="flex-1 overflow-hidden data-[state=inactive]:hidden"
        >
          {assignedToMe.length === 0 ? (
            <div className="flex h-full items-center justify-center bg-white p-12 text-center text-gray-500">
              No tickets are assigned to you. Click &ldquo;Take it&rdquo; on a
              ticket in Agent Views to claim one.
            </div>
          ) : (
            <TicketList
              tickets={assignedToMe}
              title="Assigned to Me"
              users={users}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
