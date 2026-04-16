'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  ChevronDown,
  ChevronRight,
  Globe,
  Inbox,
  Loader2,
} from 'lucide-react'
import { useTickets } from '@/hooks/use-tickets'
import { useUsers } from '@/hooks/use-users'
import { useViewConfigs } from '@/hooks/use-admin-config'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useUIStore } from '@/stores/ui-store'
import { getSlaStatus } from '@/lib/sla'
import { TicketList } from '@/components/tickets/ticket-list'
import type {
  Ticket,
  User,
  ViewConfig,
  ViewFilterConfig,
  TicketCategory,
} from '@/types/ticket'

// ── Constants ──────────────────────────────────────────────────

const TICKET_CATEGORIES: readonly string[] = [
  'Loan Origination',
  'Underwriting',
  'Closing',
  'Servicing',
  'Compliance',
  'IT Systems',
  'General',
]

// Groups are displayed in this order. Categories become department-based groups.
const VIEW_GROUP_ORDER: readonly string[] = [
  'Global',
  'My Queue',
  'By Status',
  ...TICKET_CATEGORIES,
  'Other',
]

// ── View sidebar helpers ───────────────────────────────────────

interface ViewEntry {
  id: string
  name: string
}

interface ViewGroup {
  name: string
  views: ViewEntry[]
}

/**
 * Build ordered view groups from the ViewConfig records fetched from DB.
 * Prepends a synthetic "Global > All Tickets" entry.
 */
function buildViewGroups(
  configs: ViewConfig[],
  userDepartments: string[],
  isAdmin: boolean,
): ViewGroup[] {
  const enabled = configs.filter((v) => v.enabled)

  // Determine which department groups are visible to this user
  const deptGroups = isAdmin
    ? TICKET_CATEGORIES
    : TICKET_CATEGORIES.filter((cat) => userDepartments.includes(cat))

  const orderedGroupNames: string[] = [
    'My Queue',
    'By Status',
    ...deptGroups,
    'Other',
  ]

  const groups: ViewGroup[] = orderedGroupNames
    .map((groupName) => ({
      name: groupName,
      views: enabled
        .filter((v) => v.group_name === groupName)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((v) => ({ id: v.id, name: v.name })),
    }))
    .filter((g) => g.views.length > 0)

  // Prepend Global with "All Tickets"
  const globalGroup: ViewGroup = {
    name: 'Global',
    views: [{ id: 'all-tickets', name: 'All Tickets' }],
  }

  return [globalGroup, ...groups]
}

/**
 * Apply a ViewConfig's filterConfig to a ticket list.
 * The special "all-tickets" view passes everything through.
 */
function applyViewFilter(
  tickets: Ticket[],
  viewId: string,
  configs: ViewConfig[],
  currentUserId: string,
): Ticket[] {
  if (viewId === 'all-tickets') return tickets

  const config = configs.find((c) => c.id === viewId)
  if (!config) return tickets

  const fc = config.filter_config

  return tickets.filter((t) => {
    // For "unsolved" views, exclude solved tickets
    const isUnsolved =
      config.id.endsWith('-unsolved') || config.id === 'all-unsolved'

    if (isUnsolved) {
      if (t.status === 'solved') return false
    } else if (fc.statusFilter !== 'any') {
      if (t.status !== fc.statusFilter) return false
    }

    // Assignee filter
    switch (fc.assigneeFilter) {
      case 'me':
        if (t.assigned_to !== currentUserId) return false
        break
      case 'unassigned':
        if (t.assigned_to) return false
        break
      case 'assigned':
        if (!t.assigned_to) return false
        break
    }

    // Category filter
    if (fc.categoryFilter !== 'any') {
      if (t.category !== fc.categoryFilter) return false
    }

    // SLA filter
    if (fc.slaFilter === 'breached') {
      const sla = getSlaStatus(t)
      if (!sla?.isOverdue) return false
    }
    if (fc.slaFilter === 'at-risk') {
      const sla = getSlaStatus(t)
      if (!sla?.isAtRisk) return false
    }

    return true
  })
}

// ── Page Component ─────────────────────────────────────────────

export default function TicketsPage() {
  const { data: tickets = [], isLoading: ticketsLoading } = useTickets()
  const { data: viewConfigs = [], isLoading: viewsLoading } = useViewConfigs()
  const { data: allUsers = [], isLoading: usersLoading } = useUsers()
  const { profile, isAdmin, isLoading: userLoading } = useCurrentUser()

  const { activeViewId, setActiveViewId } = useUIStore()
  const searchParams = useSearchParams()

  // Handle URL params from dashboard stat card links (e.g. /tickets?status=new)
  useEffect(() => {
    const status = searchParams.get('status')
    const sla = searchParams.get('sla')
    if (status) {
      const viewMap: Record<string, string> = {
        new: 'all-new',
        open: 'all-open',
        pending: 'pending',
        on_hold: 'on-hold',
        solved: 'solved',
      }
      if (viewMap[status]) setActiveViewId(viewMap[status])
    } else if (sla) {
      const slaMap: Record<string, string> = {
        'at-risk': 'sla-at-risk',
        breached: 'sla-breached',
      }
      if (slaMap[sla]) setActiveViewId(slaMap[sla])
    }
  }, [searchParams, setActiveViewId])

  // Collapsible group state — department groups collapsed by default
  const [collapsedGroups, setCollapsedGroups] = useState<
    Record<string, boolean>
  >(() => {
    const initial: Record<string, boolean> = {}
    // Collapse all groups except Global, My Queue, By Status
    for (const cat of TICKET_CATEGORIES) {
      initial[cat] = true
    }
    initial['Other'] = true
    return initial
  })

  const toggleGroup = (groupName: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }))
  }

  // Derive user departments
  const userDepartments = useMemo(
    () =>
      profile?.departments ??
      (profile?.department ? [profile.department] : []),
    [profile],
  )

  // Build sidebar groups
  const viewGroups = useMemo(
    () => buildViewGroups(viewConfigs, userDepartments, isAdmin),
    [viewConfigs, userDepartments, isAdmin],
  )

  // Flatten for lookup
  const allViews = useMemo(
    () => viewGroups.flatMap((g) => g.views),
    [viewGroups],
  )

  // Default to first available view if nothing selected
  const resolvedViewId =
    activeViewId && allViews.some((v) => v.id === activeViewId)
      ? activeViewId
      : allViews[0]?.id ?? 'all-tickets'

  const activeView =
    allViews.find((v) => v.id === resolvedViewId) ?? allViews[0]

  // Count tickets per view
  const viewCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const view of allViews) {
      counts[view.id] = applyViewFilter(
        tickets,
        view.id,
        viewConfigs,
        profile?.id ?? '',
      ).length
    }
    return counts
  }, [tickets, allViews, viewConfigs, profile?.id])

  // Tickets for the active view
  const filteredTickets = useMemo(
    () =>
      applyViewFilter(
        tickets,
        resolvedViewId,
        viewConfigs,
        profile?.id ?? '',
      ),
    [tickets, resolvedViewId, viewConfigs, profile?.id],
  )

  const users: User[] = useMemo(() => {
    if (allUsers.length > 0) return allUsers
    if (!profile) return []
    return [profile]
  }, [allUsers, profile])

  const isLoading = ticketsLoading || viewsLoading || userLoading || usersLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="-m-4 lg:-m-8 flex flex-col h-[calc(100vh-4rem)] lg:h-screen overflow-hidden">
      {/* ── Page Header ───────────────────────────────────────── */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-white">
        <h1 className="text-2xl font-bold text-gray-900">Agent Views</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {filteredTickets.length} ticket{filteredTickets.length !== 1 ? 's' : ''} in {activeView?.name ?? 'All Tickets'}
        </p>
      </div>

      <div className="flex flex-1 overflow-hidden">
      {/* ── Views Sidebar ─────────────────────────────────────── */}
      <aside className="w-[240px] flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
        <div className="px-3 py-2.5 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Views
          </h2>
        </div>

        <nav className="flex-1 overflow-y-auto py-1">
          {viewGroups.map((group, idx) => {
            const isCollapsed = collapsedGroups[group.name] === true
            return (
              <div key={group.name} className="mb-1">
                {/* Separator between groups */}
                {idx > 0 && (
                  <div className="mx-3 my-1 border-t border-gray-100" />
                )}

                {/* Group header (collapsible) */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.name)}
                  className="w-full flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors"
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                  {group.name === 'Global' && (
                    <Globe className="w-3 h-3" />
                  )}
                  {group.name}
                </button>

                {/* Views in group */}
                {!isCollapsed && (
                  <ul className="mt-0.5">
                    {group.views.map((view) => {
                      const isActive = resolvedViewId === view.id
                      const count = viewCounts[view.id] ?? 0
                      return (
                        <li key={view.id}>
                          <button
                            type="button"
                            onClick={() => setActiveViewId(view.id)}
                            className={`w-full flex items-center justify-between px-3 py-1.5 text-sm transition-colors ${
                              isActive
                                ? 'bg-blue-50 text-blue-700 font-medium border-l-2 border-blue-600'
                                : 'text-gray-700 hover:bg-gray-50 border-l-2 border-transparent'
                            }`}
                          >
                            <span className="truncate pr-2">{view.name}</span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                                isActive
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {count > 999
                                ? `${(count / 1000).toFixed(1)}K`
                                : count}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )
          })}
        </nav>
      </aside>

      {/* ── Main Ticket List ──────────────────────────────────── */}
      {/* ── Main Ticket List ──────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        <TicketList
          tickets={filteredTickets}
          title={activeView?.name ?? 'All Tickets'}
          users={users}
        />
      </div>
      </div>
    </div>
  )
}
