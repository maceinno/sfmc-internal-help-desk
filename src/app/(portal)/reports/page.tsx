'use client'

import { useMemo } from 'react'
import { Loader2, TrendingUp, Clock, CheckCircle, AlertTriangle } from 'lucide-react'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import { useTickets } from '@/hooks/use-tickets'
import { useUsers } from '@/hooks/use-users'
import { SLA_CONFIG } from '@/lib/sla'
import type { TicketCategory } from '@/types/ticket'

// ============================================================================
// Color constants matching the app design system
// ============================================================================

const STATUS_COLORS: Record<string, string> = {
  new: '#eab308',     // yellow-500
  open: '#ef4444',    // red-500
  pending: '#3b82f6', // blue-500
  on_hold: '#111827', // gray-900
  solved: '#9ca3af',  // gray-400
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#ef4444',  // red-500
  high: '#f97316',    // orange-500
  medium: '#eab308',  // yellow-500
  low: '#22c55e',     // green-500
}

const CATEGORY_COLORS = [
  '#3b82f6', // blue-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#f59e0b', // amber-500
  '#22c55e', // green-500
  '#06b6d4', // cyan-500
  '#6b7280', // gray-500
]

const ALL_CATEGORIES: TicketCategory[] = [
  'Loan Origination',
  'Underwriting',
  'Closing',
  'Servicing',
  'Compliance',
  'IT Systems',
  'General',
]

// ============================================================================
// Reports Page
// ============================================================================

export default function ReportsPage() {
  const { data: tickets = [], isLoading: ticketsLoading } = useTickets()
  const { data: users = [], isLoading: usersLoading } = useUsers()

  const isLoading = ticketsLoading || usersLoading

  // ── Summary stats ─────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const totalTickets = tickets.length

    const openBacklog = tickets.filter(
      (t) =>
        t.status === 'new' || t.status === 'open' || t.status === 'pending',
    ).length

    // Average resolution time for solved tickets
    const resolvedTickets = tickets.filter((t) => t.status === 'solved')
    let avgResolutionHours = 0
    if (resolvedTickets.length > 0) {
      const totalHours = resolvedTickets.reduce((sum, t) => {
        const created = new Date(t.created_at).getTime()
        const updated = new Date(t.updated_at).getTime()
        return sum + (updated - created) / (1000 * 60 * 60)
      }, 0)
      avgResolutionHours = totalHours / resolvedTickets.length
    }

    // SLA compliance rate
    let slaCompliant = 0
    resolvedTickets.forEach((t) => {
      const created = new Date(t.created_at).getTime()
      const updated = new Date(t.updated_at).getTime()
      const resolutionHours = (updated - created) / (1000 * 60 * 60)
      const slaHours = SLA_CONFIG[t.priority].hours
      if (resolutionHours <= slaHours) {
        slaCompliant++
      }
    })

    const slaComplianceRate =
      resolvedTickets.length > 0
        ? Math.round((slaCompliant / resolvedTickets.length) * 100)
        : 100

    return {
      totalTickets,
      avgResolutionTime:
        avgResolutionHours < 1
          ? `${Math.round(avgResolutionHours * 60)}m`
          : `${avgResolutionHours.toFixed(1)}h`,
      slaComplianceRate,
      openBacklog,
    }
  }, [tickets])

  // ── Status distribution ───────────────────────────────────────────────────

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {
      new: 0,
      open: 0,
      pending: 0,
      on_hold: 0,
      solved: 0,
    }
    tickets.forEach((t) => {
      counts[t.status] = (counts[t.status] || 0) + 1
    })
    return [
      { name: 'New', value: counts.new, color: STATUS_COLORS.new },
      { name: 'Open', value: counts.open, color: STATUS_COLORS.open },
      { name: 'Pending', value: counts.pending, color: STATUS_COLORS.pending },
      { name: 'On Hold', value: counts.on_hold, color: STATUS_COLORS.on_hold },
      { name: 'Solved', value: counts.solved, color: STATUS_COLORS.solved },
    ]
  }, [tickets])

  // ── Priority distribution ─────────────────────────────────────────────────

  const priorityData = useMemo(() => {
    const counts: Record<string, number> = {
      urgent: 0,
      high: 0,
      medium: 0,
      low: 0,
    }
    tickets.forEach((t) => {
      counts[t.priority] = (counts[t.priority] || 0) + 1
    })
    return [
      { name: 'Urgent', value: counts.urgent, color: PRIORITY_COLORS.urgent },
      { name: 'High', value: counts.high, color: PRIORITY_COLORS.high },
      { name: 'Medium', value: counts.medium, color: PRIORITY_COLORS.medium },
      { name: 'Low', value: counts.low, color: PRIORITY_COLORS.low },
    ]
  }, [tickets])

  // ── Category distribution ─────────────────────────────────────────────────

  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {}
    tickets.forEach((t) => {
      counts[t.category] = (counts[t.category] || 0) + 1
    })
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [tickets])

  // ── Agent workload ────────────────────────────────────────────────────────

  const agentWorkload = useMemo(() => {
    const counts: Record<string, number> = { Unassigned: 0 }

    users
      .filter((u) => u.role === 'agent' || u.role === 'admin')
      .forEach((u) => {
        counts[u.name] = 0
      })

    tickets
      .filter((t) => t.status !== 'solved')
      .forEach((t) => {
        if (t.assigned_to) {
          const user = users.find((u) => u.id === t.assigned_to)
          if (user) {
            counts[user.name] = (counts[user.name] || 0) + 1
          }
        } else {
          counts['Unassigned']++
        }
      })

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [tickets, users])

  // ── Category breakdown table ──────────────────────────────────────────────

  const categoryBreakdown = useMemo(() => {
    // Group by ticket_type (the department), not category
    const typeSet = new Set<string>()
    tickets.forEach((t) => {
      if (t.ticket_type) typeSet.add(t.ticket_type)
    })
    const types = Array.from(typeSet).sort()

    return types.map((type) => {
      const typeTickets = tickets.filter((t) => t.ticket_type === type)
      return {
        category: type,
        new: typeTickets.filter((t) => t.status === 'new').length,
        open: typeTickets.filter((t) => t.status === 'open').length,
        pending: typeTickets.filter((t) => t.status === 'pending').length,
        onHold: typeTickets.filter((t) => t.status === 'on_hold').length,
        solved: typeTickets.filter((t) => t.status === 'solved').length,
        total: typeTickets.length,
      }
    })
  }, [tickets])

  const totals = useMemo(() => {
    return categoryBreakdown.reduce(
      (acc, row) => ({
        new: acc.new + row.new,
        open: acc.open + row.open,
        pending: acc.pending + row.pending,
        onHold: acc.onHold + row.onHold,
        solved: acc.solved + row.solved,
        total: acc.total + row.total,
      }),
      { new: 0, open: 0, pending: 0, onHold: 0, solved: 0, total: 0 },
    )
  }, [categoryBreakdown])

  // ── Monthly agent/department breakdown ─────────────────────────────────────

  const monthlyBreakdown = useMemo(() => {
    const rows: {
      month: string
      agent: string
      department: string
      new: number
      open: number
      pending: number
      onHold: number
      solved: number
      total: number
    }[] = []

    const byKey = new Map<string, typeof rows[0]>()

    tickets.forEach((t) => {
      const date = new Date(t.created_at)
      const month = date.toLocaleString('en-US', { month: 'short', year: 'numeric' })
      const agent = t.assigned_to
        ? (users.find((u) => u.id === t.assigned_to)?.name ?? 'Unknown')
        : 'Unassigned'
      const department = t.ticket_type ?? 'Other'
      const key = `${month}|${agent}|${department}`

      if (!byKey.has(key)) {
        byKey.set(key, { month, agent, department, new: 0, open: 0, pending: 0, onHold: 0, solved: 0, total: 0 })
      }
      const row = byKey.get(key)!
      row.total++
      if (t.status === 'new') row.new++
      else if (t.status === 'open') row.open++
      else if (t.status === 'pending') row.pending++
      else if (t.status === 'on_hold') row.onHold++
      else if (t.status === 'solved') row.solved++
    })

    return Array.from(byKey.values()).sort((a, b) => {
      // Sort by month desc, then agent, then department
      const ma = new Date(a.month).getTime()
      const mb = new Date(b.month).getTime()
      if (mb !== ma) return mb - ma
      if (a.agent !== b.agent) return a.agent.localeCompare(b.agent)
      return a.department.localeCompare(b.department)
    })
  }, [tickets, users])

  // ── Loading state ─────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm font-medium">Loading reports...</p>
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Reports &amp; Analytics
        </h1>
        <p className="text-gray-500 mt-1">
          Ticket metrics and performance insights
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Tickets</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats.totalTickets}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-blue-50 text-blue-600">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-4">All time</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">
                Avg Resolution Time
              </p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats.avgResolutionTime}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-purple-50 text-purple-600">
              <Clock className="w-6 h-6" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-4">Resolved tickets</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">
                SLA Compliance Rate
              </p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats.slaComplianceRate}%
              </p>
            </div>
            <div className="p-3 rounded-lg bg-green-50 text-green-600">
              <CheckCircle className="w-6 h-6" />
            </div>
          </div>
          <p className="text-sm text-green-600 font-medium mt-4">On target</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Open Backlog</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats.openBacklog}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-amber-50 text-amber-600">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-4">Needs attention</p>
        </div>
      </div>

      {/* Charts Row 1: Status + Category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution (Pie Chart) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-6">
            Tickets by Status
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`status-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Distribution (Bar Chart) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-6">
            Tickets by Category
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={categoryData}
                layout="vertical"
                margin={{ left: 100 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                  {categoryData.map((_entry, index) => (
                    <Cell
                      key={`cat-${index}`}
                      fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 2: Priority + Agent Workload */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority Distribution (Bar Chart) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-6">
            Tickets by Priority
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priorityData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {priorityData.map((entry, index) => (
                    <Cell key={`priority-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Agent Workload (Bar Chart) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-6">Agent Workload</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={agentWorkload}
                layout="vertical"
                margin={{ left: 100 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                />
                <Tooltip />
                <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Category Breakdown Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">
            Ticket Types Submitted/Worked
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  New
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Open
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pending
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  On Hold
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Solved
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {categoryBreakdown.map((row) => (
                <tr key={row.category}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {row.category}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-yellow-600 font-medium">
                    {row.new || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-red-600 font-medium">
                    {row.open || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-blue-600 font-medium">
                    {row.pending || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900 font-medium">
                    {row.onHold || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">
                    {row.solved || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-bold text-gray-900">
                    {row.total}
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-bold">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  Total
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-yellow-600">
                  {totals.new}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-red-600">
                  {totals.open}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-blue-600">
                  {totals.pending}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                  {totals.onHold}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">
                  {totals.solved}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                  {totals.total}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      {/* Monthly Agent/Department Breakdown */}
      {monthlyBreakdown.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">
              Tickets Per Month Per Agent Per Department
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Breakdown of ticket volume by month, assigned agent, and department.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Agent</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">New</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Open</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Pending</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">On Hold</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Solved</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {monthlyBreakdown.map((row, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? '' : 'bg-gray-50/50'}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{row.month}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{row.agent}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{row.department}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-yellow-600 font-medium">{row.new || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-red-600 font-medium">{row.open || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-blue-600 font-medium">{row.pending || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900 font-medium">{row.onHold || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">{row.solved || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold text-gray-900">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
