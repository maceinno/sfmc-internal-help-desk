'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2 } from 'lucide-react'
import { useTickets } from '@/hooks/use-tickets'
import { useSlaPolicies } from '@/hooks/use-admin-config'
import { getAtRiskTickets, getOverdueTickets, getSlaStatus } from '@/lib/sla'
import { StatsCards } from '@/components/dashboard/stats-cards'
import { SlaAtRiskTable } from '@/components/dashboard/sla-at-risk-table'
import { StatusBadge } from '@/components/tickets/status-badge'
import { PriorityBadge } from '@/components/tickets/priority-badge'
import { SlaIndicator } from '@/components/tickets/sla-indicator'

export default function DashboardPage() {
  const { data: tickets = [], isLoading: ticketsLoading } = useTickets()
  const { data: policies = [] } = useSlaPolicies()
  const router = useRouter()

  const stats = useMemo(() => {
    const newCount = tickets.filter((t) => t.status === 'new').length
    const openCount = tickets.filter((t) => t.status === 'open').length
    const pendingCount = tickets.filter((t) => t.status === 'pending').length
    const atRisk = getAtRiskTickets(tickets, policies)
    const overdue = getOverdueTickets(tickets, policies)

    return { newCount, openCount, pendingCount, atRisk, overdue }
  }, [tickets, policies])

  const recentTickets = useMemo(() => {
    return tickets.slice(0, 5)
  }, [tickets])

  if (ticketsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm font-medium">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Internal operations support overview
          </p>
        </div>
        <div className="flex space-x-3">
          <Link
            href="/tickets"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            View All Tickets
          </Link>
          <Link
            href="/tickets/new"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm"
          >
            New Request
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <StatsCards
        newCount={stats.newCount}
        openCount={stats.openCount}
        pendingCount={stats.pendingCount}
        atRiskCount={stats.atRisk.length}
        breachedCount={stats.overdue.length}
      />

      {/* SLA At Risk / Breached Tables */}
      <SlaAtRiskTable
        atRiskTickets={stats.atRisk}
        overdueTickets={stats.overdue}
        policies={policies}
      />

      {/* Recent Requests */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">
            Recent Requests
          </h2>
          <Link
            href="/tickets"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center"
          >
            View all <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </div>
        {recentTickets.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            No tickets yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subject
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentTickets.map((ticket) => {
                  const slaStatus = getSlaStatus(ticket, policies)
                  return (
                    <tr
                      key={ticket.id}
                      onClick={() => router.push(`/tickets/${ticket.id}`)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {ticket.id.slice(0, 8)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 max-w-xs truncate">
                        {ticket.title}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <StatusBadge status={ticket.status} />
                          {slaStatus?.isOverdue && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                              OVERDUE
                            </span>
                          )}
                          {slaStatus?.isAtRisk && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                              AT RISK
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <PriorityBadge priority={ticket.priority} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
