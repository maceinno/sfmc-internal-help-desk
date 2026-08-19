'use client'

import { useMemo, useState } from 'react'
import { TicketFilters } from './ticket-filters'
import { TicketTable } from './ticket-table'
import { getSlaStatus } from '@/lib/sla'
import { buildUserIndex, ticketMatchesSearch } from '@/lib/tickets/search'
import { useReplySearch } from '@/hooks/use-reply-search'
import { useSlaPolicies, useDepartmentSchedules } from '@/hooks/use-admin-config'
import type { Ticket, User } from '@/types/ticket'
import type { PresenceUser } from '@/hooks/use-ticket-presence'
import type {
  StatusFilterValue,
  PriorityFilterValue,
  CategoryFilterValue,
  SortField,
  SortDirection,
} from './ticket-filters'

// ── Priority ordering for sort ─────────────────────────────────

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
}

const STATUS_ORDER: Record<string, number> = {
  new: 0,
  open: 1,
  pending: 2,
  on_hold: 3,
  solved: 4,
}

// ── Props ──────────────────────────────────────────────────────

interface TicketListProps {
  tickets: Ticket[]
  allTickets?: Ticket[]
  title: string
  users: User[]
  /** Map of ticketId → agents currently viewing that ticket. */
  presenceMap?: Map<string, PresenceUser[]>
}

// ── Component ──────────────────────────────────────────────────

export function TicketList({ tickets, allTickets, title, users, presenceMap }: TicketListProps) {
  const { data: slaPolicies = [] } = useSlaPolicies()
  const { data: schedules = [] } = useDepartmentSchedules()

  // Filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('all')
  const [priorityFilter, setPriorityFilter] =
    useState<PriorityFilterValue>('all')
  const [categoryFilter, setCategoryFilter] =
    useState<CategoryFilterValue>('all')

  // Sort state — null means "no user-applied sort" (natural query order).
  // Column header click cycles: null → asc → desc → null.
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const handleSort = (field: SortField) => {
    if (sortField !== field) {
      setSortField(field)
      setSortDirection('asc')
      return
    }
    if (sortDirection === 'asc') {
      setSortDirection('desc')
      return
    }
    // Third click — clear the sort and fall back to natural order.
    setSortField(null)
    setSortDirection('asc')
  }

  // id → user, for matching a search term against requester/assignee names
  // and emails without re-scanning the user array per ticket.
  const usersById = useMemo(() => buildUserIndex(users), [users])

  const isSearching = searchTerm.trim().length > 0

  // Reply bodies aren't in the loaded list, so they're searched server-side
  // and merged in below. Everything else matches locally and instantly.
  const { matches: replyMatches, isLoading: repliesLoading } =
    useReplySearch(searchTerm)

  const replyMatchIds = useMemo(
    () => new Set(replyMatches.map((m) => m.ticketId)),
    [replyMatches],
  )

  // Filtered + sorted tickets
  const displayTickets = useMemo(() => {
    let filtered = tickets

    // Search runs across EVERY ticket the user can see, not just the view
    // that happens to be on screen. Searching from an "Open" list used to
    // hide solved tickets, which made a search for a loan number look like
    // "no such ticket". The dropdown filters below still narrow the results,
    // so a deliberate status filter is respected.
    if (searchTerm.trim()) {
      const pool = allTickets ?? filtered
      filtered = pool.filter(
        (t) =>
          ticketMatchesSearch(t, searchTerm, { usersById }) ||
          replyMatchIds.has(t.id),
      )
    }

    // Status (including overdue pseudo-status)
    if (statusFilter === 'overdue') {
      filtered = filtered.filter((t) => {
        const sla = getSlaStatus(t, slaPolicies, schedules)
        return sla?.isOverdue === true
      })
    } else if (statusFilter !== 'all') {
      filtered = filtered.filter((t) => t.status === statusFilter)
    }

    // Priority
    if (priorityFilter !== 'all') {
      filtered = filtered.filter((t) => t.priority === priorityFilter)
    }

    // Category
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((t) => t.category === categoryFilter)
    }

    // No sort applied → preserve the query's natural order.
    if (sortField === null) return filtered

    // Map user id → name for assignee-name sorting (raw assigned_to is
    // a UUID, sorting by that is meaningless to humans).
    const userNameById = new Map<string, string>()
    for (const u of users) userNameById.set(u.id, u.name)

    return [...filtered].sort((a, b) => {
      let aVal: number | string | undefined
      let bVal: number | string | undefined

      if (sortField === 'priority') {
        aVal = PRIORITY_ORDER[a.priority] ?? 99
        bVal = PRIORITY_ORDER[b.priority] ?? 99
      } else if (sortField === 'status') {
        aVal = STATUS_ORDER[a.status] ?? 99
        bVal = STATUS_ORDER[b.status] ?? 99
      } else if (sortField === 'assigned_to') {
        // Sort by assignee name; unassigned tickets fall to the bottom
        // (the undefined-handling below puts undefined last).
        aVal = a.assigned_to ? userNameById.get(a.assigned_to)?.toLowerCase() : undefined
        bVal = b.assigned_to ? userNameById.get(b.assigned_to)?.toLowerCase() : undefined
      } else if (sortField === 'created_by') {
        aVal = a.created_by ? userNameById.get(a.created_by)?.toLowerCase() : undefined
        bVal = b.created_by ? userNameById.get(b.created_by)?.toLowerCase() : undefined
      } else {
        aVal = a[sortField] as string | undefined
        bVal = b[sortField] as string | undefined
      }

      if (aVal === undefined && bVal === undefined) return 0
      if (aVal === undefined) return 1
      if (bVal === undefined) return -1

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }, [
    tickets,
    searchTerm,
    statusFilter,
    priorityFilter,
    categoryFilter,
    sortField,
    sortDirection,
    slaPolicies,
    schedules,
    allTickets,
    users,
    usersById,
    replyMatchIds,
  ])

  // How many of the shown results are here *because of* a reply — i.e. the
  // term appears nowhere on the ticket itself. Worth calling out, otherwise
  // those rows look like false positives.
  const replyMatchesShown = useMemo(() => {
    if (!isSearching) return 0
    return displayTickets.filter(
      (t) =>
        replyMatchIds.has(t.id) &&
        !ticketMatchesSearch(t, searchTerm, { usersById }),
    ).length
  }, [displayTickets, replyMatchIds, isSearching, searchTerm, usersById])

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {displayTickets.length} ticket{displayTickets.length !== 1 ? 's' : ''}
            {isSearching && (
              <span className="text-gray-400">
                {' '}
                — searching all tickets, every status
                {repliesLoading
                  ? ', still checking replies…'
                  : replyMatchesShown > 0 &&
                    `, ${replyMatchesShown} matched in a reply`}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Filters */}
      <TicketFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        priorityFilter={priorityFilter}
        onPriorityFilterChange={setPriorityFilter}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
      />

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <TicketTable
          tickets={displayTickets}
          users={users}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={handleSort}
          searchTerm={searchTerm}
          slaPolicies={slaPolicies}
          schedules={schedules}
          presenceMap={presenceMap}
        />
      </div>
    </div>
  )
}
