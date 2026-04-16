'use client'

import { useRouter } from 'next/navigation'
import { useTimezone } from '@/hooks/use-timezone'
import { ArrowUpDown, Inbox } from 'lucide-react'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { StatusBadge } from '@/components/tickets/status-badge'
import { PriorityBadge } from '@/components/tickets/priority-badge'
import { SlaIndicator } from '@/components/tickets/sla-indicator'
import type { Ticket, User } from '@/types/ticket'
import type { SortField, SortDirection } from './ticket-filters'

// ── Column definitions ─────────────────────────────────────────

interface Column {
  key: string
  label: string
  sortable: boolean
  /** Optional sort field override (e.g. key = "sla" is not sortable) */
  sortKey?: SortField
}

const COLUMNS: Column[] = [
  { key: 'id', label: 'ID', sortable: true, sortKey: 'created_at' },
  { key: 'title', label: 'Title', sortable: false },
  { key: 'status', label: 'Status', sortable: true, sortKey: 'status' },
  { key: 'priority', label: 'Priority', sortable: true, sortKey: 'priority' },
  { key: 'category', label: 'Category', sortable: false },
  { key: 'assigned_to', label: 'Assignee', sortable: false },
  { key: 'created_at', label: 'Created', sortable: true, sortKey: 'created_at' },
  { key: 'sla', label: 'SLA', sortable: false },
]

// ── Props ──────────────────────────────────────────────────────

interface TicketTableProps {
  tickets: Ticket[]
  users: User[]
  sortField: SortField
  sortDirection: SortDirection
  onSort: (field: SortField) => void
  searchTerm?: string
}

// ── Helpers ────────────────────────────────────────────────────

function getUserName(users: User[], userId?: string): string {
  if (!userId) return 'Unassigned'
  return users.find((u) => u.id === userId)?.name ?? 'Unknown'
}

// ── Component ──────────────────────────────────────────────────

export function TicketTable({
  tickets,
  users,
  sortField,
  sortDirection,
  onSort,
  searchTerm,
}: TicketTableProps) {
  const { formatDate } = useTimezone()
  const router = useRouter()

  const handleRowClick = (ticketId: string) => {
    router.push(`/tickets/${ticketId}`)
  }

  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <Inbox className="w-12 h-12 text-gray-300 mb-3" />
        <p className="text-lg font-medium text-gray-900">
          No tickets found
        </p>
        <p className="text-sm mt-1">
          {searchTerm
            ? 'Try adjusting your search or filter criteria'
            : "You're all caught up!"}
        </p>
      </div>
    )
  }

  return (
  <>
    <Table>
      <TableHeader>
        <TableRow className="bg-gray-50/80">
          {COLUMNS.map((col) => {
            const isSorted = col.sortable && col.sortKey === sortField
            return (
              <TableHead
                key={col.key}
                className={`text-xs uppercase tracking-wider ${
                  col.sortable
                    ? 'cursor-pointer select-none hover:bg-gray-100 transition-colors'
                    : ''
                }`}
                onClick={() => {
                  if (col.sortable && col.sortKey) {
                    onSort(col.sortKey)
                  }
                }}
              >
                <div className="flex items-center gap-1">
                  <span>{col.label}</span>
                  {col.sortable && (
                    <ArrowUpDown
                      className={`w-3 h-3 ${
                        isSorted
                          ? 'text-blue-500'
                          : 'text-gray-300'
                      }`}
                    />
                  )}
                  {isSorted && (
                    <span className="text-[10px] text-blue-500 font-normal normal-case">
                      {sortDirection === 'asc' ? 'asc' : 'desc'}
                    </span>
                  )}
                </div>
              </TableHead>
            )
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {tickets.map((ticket) => {
          const assigneeName = getUserName(users, ticket.assigned_to)
          return (
            <TableRow
              key={ticket.id}
              className="cursor-pointer hover:bg-blue-50/60 transition-colors"
              onClick={() => handleRowClick(ticket.id)}
            >
              <TableCell className="font-medium text-gray-900 text-sm">
                {ticket.id}
              </TableCell>
              <TableCell className="text-sm text-gray-700 max-w-xs truncate">
                {ticket.title}
              </TableCell>
              <TableCell>
                <StatusBadge status={ticket.status} />
              </TableCell>
              <TableCell>
                <PriorityBadge priority={ticket.priority} />
              </TableCell>
              <TableCell className="text-sm text-gray-500">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                  {ticket.category}
                </span>
              </TableCell>
              <TableCell className="text-sm text-gray-500">
                {ticket.assigned_to ? (
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-600">
                      {assigneeName.charAt(0)}
                    </div>
                    <span className="truncate max-w-[100px]">
                      {assigneeName}
                    </span>
                  </div>
                ) : (
                  <span className="text-gray-400 italic">Unassigned</span>
                )}
              </TableCell>
              <TableCell className="text-sm text-gray-500">
                {formatDate(ticket.created_at)}
              </TableCell>
              <TableCell>
                <SlaIndicator ticket={ticket} />
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
    {tickets.length > 0 && (
      <div className="py-4 text-center text-xs text-gray-400 border-t border-gray-100">
        Showing {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
      </div>
    )}
  </>
  )
}
