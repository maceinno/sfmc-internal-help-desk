'use client'

import { useMemo } from 'react'
import { Building2, Loader2, ShieldAlert } from 'lucide-react'
import { useTickets } from '@/hooks/use-tickets'
import { useUsers } from '@/hooks/use-users'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useBranches } from '@/hooks/use-admin-config'
import { filterBranchTickets } from '@/lib/permissions/policies'
import { TicketList } from '@/components/tickets/ticket-list'

export default function BranchPage() {
  const { profile, isLoading: userLoading } = useCurrentUser()
  const { data: tickets = [], isLoading: ticketsLoading } = useTickets()
  const { data: users = [], isLoading: usersLoading } = useUsers()
  const { data: branches = [], isLoading: branchesLoading } = useBranches()

  // Resolve all managed branch names for the title
  const branchNames = useMemo(() => {
    if (branches.length === 0 || !profile) return []
    const ids = profile.managed_branch_ids?.length
      ? profile.managed_branch_ids
      : profile.managed_branch_id
        ? [profile.managed_branch_id]
        : []
    return ids
      .map((id) => branches.find((b) => b.id === id)?.name)
      .filter(Boolean) as string[]
  }, [profile, branches])

  const branchTickets = useMemo(() => {
    if (!profile) return []
    return filterBranchTickets(profile, tickets, users)
  }, [profile, tickets, users])

  const isLoading = userLoading || ticketsLoading || usersLoading || branchesLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    )
  }

  const hasBranches =
    (profile?.managed_branch_ids?.length ?? 0) > 0 || !!profile?.managed_branch_id

  if (!profile?.has_branch_access || !hasBranches) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-7 h-7 text-red-500" />
          <h1 className="text-2xl font-bold text-gray-900">Unauthorized</h1>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
          You do not have branch manager access. Contact an administrator if you
          believe this is an error.
        </div>
      </div>
    )
  }

  return (
    <div className="-m-4 lg:-m-8 flex h-[calc(100vh-4rem)] lg:h-screen overflow-hidden">
      <div className="flex-1 overflow-hidden">
        <TicketList
          tickets={branchTickets}
          title={
            branchNames.length > 1
              ? `My Branches: ${branchNames.join(', ')}`
              : `My Branch: ${branchNames[0] ?? 'Unknown'}`
          }
          users={users}
        />
      </div>
    </div>
  )
}
