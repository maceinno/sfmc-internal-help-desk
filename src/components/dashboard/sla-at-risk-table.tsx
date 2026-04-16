'use client'

import { useRouter } from 'next/navigation'
import { AlertCircle, AlertTriangle } from 'lucide-react'
import type { Ticket, User, SlaPolicy, DepartmentSchedule } from '@/types/ticket'
import { getSlaStatus, formatTimeRemaining } from '@/lib/sla'
import { PriorityBadge } from '@/components/tickets/priority-badge'
import { StatusBadge } from '@/components/tickets/status-badge'
import { SlaIndicator } from '@/components/tickets/sla-indicator'

interface SlaAtRiskTableProps {
  atRiskTickets: Ticket[]
  overdueTickets: Ticket[]
  users?: User[]
  policies?: SlaPolicy[]
  schedules?: DepartmentSchedule[]
}

export function SlaAtRiskTable({
  atRiskTickets,
  overdueTickets,
  users = [],
  policies,
  schedules,
}: SlaAtRiskTableProps) {
  const router = useRouter()

  const getUserName = (userId: string | null) => {
    if (!userId) return null
    return users.find((u) => u.id === userId)?.name ?? null
  }

  const navigateToTicket = (ticketId: string) => {
    router.push(`/tickets/${ticketId}`)
  }

  return (
    <>
      {/* SLA At Risk Section */}
      {atRiskTickets.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-amber-200 overflow-hidden">
          <div className="p-6 border-b border-amber-100 bg-amber-50 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <h2 className="text-lg font-semibold text-amber-900">
                SLA At Risk Tickets
              </h2>
            </div>
            <span className="text-sm font-medium text-amber-700 bg-amber-100 px-3 py-1 rounded-full">
              {atRiskTickets.length} At Risk
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-amber-100">
              <thead className="bg-amber-50/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-amber-800 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-amber-800 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-amber-800 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-amber-800 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-amber-800 uppercase tracking-wider">
                    Assignee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-amber-800 uppercase tracking-wider">
                    SLA Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-amber-100">
                {atRiskTickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    onClick={() => navigateToTicket(ticket.id)}
                    className="hover:bg-amber-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {ticket.id.slice(0, 8)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 max-w-xs truncate">
                      {ticket.title}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={ticket.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <PriorityBadge priority={ticket.priority} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {getUserName(ticket.assigned_to) ?? <span className="italic text-gray-400">Unassigned</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <SlaIndicator
                        ticket={ticket}
                        policies={policies}
                        schedules={schedules}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SLA Breached Section */}
      {overdueTickets.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden">
          <div className="p-6 border-b border-red-100 bg-red-50 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <h2 className="text-lg font-semibold text-red-900">
                SLA Breached Tickets
              </h2>
            </div>
            <span className="text-sm font-medium text-red-700 bg-red-100 px-3 py-1 rounded-full">
              {overdueTickets.length} Overdue
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-red-100">
              <thead className="bg-red-50/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider">
                    Assignee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider">
                    SLA Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-red-100">
                {overdueTickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    onClick={() => navigateToTicket(ticket.id)}
                    className="hover:bg-red-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {ticket.id.slice(0, 8)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 max-w-xs truncate">
                      {ticket.title}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={ticket.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <PriorityBadge priority={ticket.priority} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {getUserName(ticket.assigned_to) ?? <span className="italic text-gray-400">Unassigned</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <SlaIndicator
                        ticket={ticket}
                        policies={policies}
                        schedules={schedules}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
