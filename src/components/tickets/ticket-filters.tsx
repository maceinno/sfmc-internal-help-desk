'use client'

import { useMemo } from 'react'
import { Search } from 'lucide-react'
import { useDepartmentCategories } from '@/hooks/use-admin-config'
import type { TicketStatus, TicketPriority, TicketCategory, Ticket } from '@/types/ticket'

// ── Filter / Sort value types ──────────────────────────────────

export type StatusFilterValue = TicketStatus | 'all' | 'overdue'
export type PriorityFilterValue = TicketPriority | 'all'
export type CategoryFilterValue = TicketCategory | 'all'
export type SortField = keyof Pick<
  Ticket,
  'updated_at' | 'created_at' | 'priority' | 'status' | 'assigned_to'
>
export type SortDirection = 'asc' | 'desc'

// ── Constants ──────────────────────────────────────────────────

const STATUS_OPTIONS: { value: StatusFilterValue; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'new', label: 'New' },
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Pending' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'solved', label: 'Solved' },
]

const PRIORITY_OPTIONS: { value: PriorityFilterValue; label: string }[] = [
  { value: 'all', label: 'All Priorities' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

// Category options come from Admin → Categories at runtime; see the
// CATEGORY_OPTIONS useMemo inside the component below.

// ── Props ──────────────────────────────────────────────────────

interface TicketFiltersProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  statusFilter: StatusFilterValue
  onStatusFilterChange: (value: StatusFilterValue) => void
  priorityFilter: PriorityFilterValue
  onPriorityFilterChange: (value: PriorityFilterValue) => void
  categoryFilter: CategoryFilterValue
  onCategoryFilterChange: (value: CategoryFilterValue) => void
}

// ── Component ──────────────────────────────────────────────────

export function TicketFilters({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  priorityFilter,
  onPriorityFilterChange,
  categoryFilter,
  onCategoryFilterChange,
}: TicketFiltersProps) {
  const { data: departmentGroups = [] } = useDepartmentCategories()
  const CATEGORY_OPTIONS = useMemo(
    () => [
      { value: 'all' as const, label: 'All Categories' },
      ...departmentGroups.map((g) => ({
        value: g.ticket_type as TicketCategory,
        label: g.ticket_type,
      })),
    ],
    [departmentGroups],
  )
  return (
    <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-b border-gray-200 bg-gray-50/50">
      {/* Search */}
      <div className="relative flex-1 min-w-[180px] max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
        <input
          type="text"
          placeholder="Search title or ID..."
          className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {/* Status */}
      <select
        value={statusFilter}
        onChange={(e) => onStatusFilterChange(e.target.value as StatusFilterValue)}
        className="h-8 text-sm border border-gray-300 rounded-md px-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Priority */}
      <select
        value={priorityFilter}
        onChange={(e) =>
          onPriorityFilterChange(e.target.value as PriorityFilterValue)
        }
        className="h-8 text-sm border border-gray-300 rounded-md px-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
      >
        {PRIORITY_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Category */}
      <select
        value={categoryFilter}
        onChange={(e) =>
          onCategoryFilterChange(e.target.value as CategoryFilterValue)
        }
        className="h-8 text-sm border border-gray-300 rounded-md px-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
      >
        {CATEGORY_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}
