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
  title: string
  users: User[]
}

// ── Component ──────────────────────────────────────────────────

export function TicketList({ tickets, title, users }: TicketListProps) {
  // Filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('all')
  const [priorityFilter, setPriorityFilter] =
    useState<PriorityFilterValue>('all')
  const [categoryFilter, setCategoryFilter] =
    useState<CategoryFilterValue>('all')

  // Sort state
  const [sortField, setSortField] = useState<SortField>('updated_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  // Filtered + sorted tickets
  const displayTickets = useMemo(() => {
    let filtered = tickets

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
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

    // Sort
    return [...filtered].sort((a, b) => {
      let aVal: number | string | undefined
      let bVal: number | string | undefined

      if (sortField === 'priority') {
        aVal = PRIORITY_ORDER[a.priority] ?? 99
        bVal = PRIORITY_ORDER[b.priority] ?? 99
      } else if (sortField === 'status') {
        aVal = STATUS_ORDER[a.status] ?? 99
        bVal = STATUS_ORDER[b.status] ?? 99
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
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          <p className="text-xs text-gray-500 mt-0.5">
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
        sortField={sortField}
        onSortFieldChange={setSortField}
        sortDirection={sortDirection}
        onSortDirectionChange={setSortDirection}
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
