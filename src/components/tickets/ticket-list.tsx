'use client'

import { useMemo, useState } from 'react'
import { TicketFilters } from './ticket-filters'
import { TicketTable } from './ticket-table'
import { getSlaStatus } from '@/lib/sla'
import type { Ticket, User } from '@/types/ticket'
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
}

// ── Component ──────────────────────────────────────────────────

export function TicketList({ tickets, allTickets, title, users }: TicketListProps) {
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

  // Filtered + sorted tickets
  const displayTickets = useMemo(() => {
    let filtered = tickets

    // Search — when the term looks like a ticket ID (e.g. "T-1093"),
    // search across ALL tickets so agents can find tickets outside the
    // current view. Otherwise search within the current view only.
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      const isTicketIdSearch = /^t-\d+$/i.test(searchTerm.trim())
      const pool = isTicketIdSearch && allTickets ? allTickets : filtered
      filtered = pool.filter(
        (t) =>
          t.title.toLowerCase().includes(term) ||
          t.id.toLowerCase().includes(term),
      )
    }

    // Status (including overdue pseudo-status)
    if (statusFilter === 'overdue') {
      filtered = filtered.filter((t) => {
        const sla = getSlaStatus(t)
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
  ])

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {displayTickets.length} ticket{displayTickets.length !== 1 ? 's' : ''}
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
        />
      </div>
    </div>
  )
}
