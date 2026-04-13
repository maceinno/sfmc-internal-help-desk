import type { User, Ticket } from '@/types/ticket'

// ============================================================================
// Role constants
// ============================================================================

const ADMIN = 'admin' as const
const AGENT = 'agent' as const
const EMPLOYEE = 'employee' as const

// ============================================================================
// Pages accessible by each role
// ============================================================================

/** Pages every employee (including managers with branch/region access) can reach. */
const EMPLOYEE_PAGES = ['my-tickets', 'cc-tickets', 'create-ticket', 'ticket-detail']

/** Pages available to agents and admins. */
const AGENT_PAGES = [
  ...EMPLOYEE_PAGES,
  'dashboard',
  'agent-overview',
  'reports',
]

/** Pages available only to admins. */
const ADMIN_PAGES = [...AGENT_PAGES, 'admin-settings']

// ============================================================================
// Helpers (internal)
// ============================================================================

/**
 * Return true when the ticket's creator OR assignee belongs to the user's
 * managed branch.
 */
function ticketMatchesBranch(
  user: User,
  ticket: Ticket,
  allUsers: User[],
): boolean {
  if (!user.hasBranchAccess || !user.managedBranchId) return false

  const creator = allUsers.find((u) => u.id === ticket.createdBy)
  const assignee = ticket.assignedTo
    ? allUsers.find((u) => u.id === ticket.assignedTo)
    : null

  return (
    (!!creator && creator.branchId === user.managedBranchId) ||
    (!!assignee && assignee.branchId === user.managedBranchId)
  )
}

/**
 * Return true when the ticket's creator OR assignee belongs to the user's
 * managed region.
 */
function ticketMatchesRegion(
  user: User,
  ticket: Ticket,
  allUsers: User[],
): boolean {
  if (!user.hasRegionalAccess || !user.managedRegionId) return false

  const creator = allUsers.find((u) => u.id === ticket.createdBy)
  const assignee = ticket.assignedTo
    ? allUsers.find((u) => u.id === ticket.assignedTo)
    : null

  return (
    (!!creator && creator.regionId === user.managedRegionId) ||
    (!!assignee && assignee.regionId === user.managedRegionId)
  )
}

// ============================================================================
// Public API: single-ticket checks
// ============================================================================

/**
 * Check if a user can view a specific ticket based on role, team assignment,
 * CC list, branch, and region.
 *
 * Rules (derived from the prototype's `visibleTickets` filter):
 *   - Admin: can view every ticket.
 *   - Agent: can view a ticket when *any* of these are true:
 *       1. The ticket's assignedTeam is in the agent's teamIds.
 *       2. The agent is the assignee.
 *       3. The agent created the ticket.
 *       4. The agent is in the ticket's CC list.
 *       5. The agent has branch/region access and the ticket matches.
 *   - Employee: can view a ticket when *any* of these are true:
 *       1. They created the ticket.
 *       2. They are CC'd on the ticket.
 *       3. They have branch/region access and the ticket matches.
 */
export function canViewTicket(
  user: User,
  ticket: Ticket,
  allUsers: User[],
): boolean {
  if (user.role === ADMIN) return true

  if (user.role === AGENT) {
    const userTeams = user.teamIds ?? []
    const teamMatch = ticket.assignedTeam
      ? userTeams.includes(ticket.assignedTeam)
      : false
    const isAssignee = ticket.assignedTo === user.id
    const isCreator = ticket.createdBy === user.id
    const isCCd = ticket.cc?.includes(user.id) ?? false

    if (teamMatch || isAssignee || isCreator || isCCd) return true

    // Branch / region access
    if (user.hasRegionalAccess || user.hasBranchAccess) {
      return (
        ticketMatchesRegion(user, ticket, allUsers) ||
        ticketMatchesBranch(user, ticket, allUsers)
      )
    }

    return false
  }

  // Employee
  if (ticket.createdBy === user.id) return true
  if (ticket.cc?.includes(user.id)) return true

  if (user.hasRegionalAccess || user.hasBranchAccess) {
    return (
      ticketMatchesRegion(user, ticket, allUsers) ||
      ticketMatchesBranch(user, ticket, allUsers)
    )
  }

  return false
}

/**
 * Check if a user can edit / update a ticket.
 *
 * Rules:
 *   - Admin: always.
 *   - Agent: when they are the assignee or the creator.
 *   - Employee: when they are the creator.
 */
export function canEditTicket(user: User, ticket: Ticket): boolean {
  if (user.role === ADMIN) return true
  if (user.role === AGENT) {
    return ticket.assignedTo === user.id || ticket.createdBy === user.id
  }
  return ticket.createdBy === user.id
}

/**
 * Check if a user can view internal notes. Only agents and admins can.
 */
export function canViewInternalNotes(user: User): boolean {
  return user.role === ADMIN || user.role === AGENT
}

/**
 * Check if a user can access the admin settings page.
 */
export function canAccessAdmin(user: User): boolean {
  return user.role === ADMIN
}

/**
 * Check if a user can view branch-filtered tickets (has branch manager access).
 */
export function canViewBranchTickets(user: User): boolean {
  return !!user.hasBranchAccess && !!user.managedBranchId
}

/**
 * Check if a user can view region-filtered tickets (has regional manager access).
 */
export function canViewRegionTickets(user: User): boolean {
  return !!user.hasRegionalAccess && !!user.managedRegionId
}

/**
 * Check if a user can access the dashboard. Agents and admins can.
 */
export function canAccessDashboard(user: User): boolean {
  return user.role === ADMIN || user.role === AGENT
}

/**
 * Check if a user can access the agent overview page.
 */
export function canAccessAgentOverview(user: User): boolean {
  return user.role === ADMIN || user.role === AGENT
}

/**
 * Check if a user can access the reports page.
 */
export function canAccessReports(user: User): boolean {
  return user.role === ADMIN || user.role === AGENT
}

/**
 * Get the list of page identifiers a user is allowed to access.
 *
 * Branch / region pages are appended dynamically when the user has the
 * corresponding access flags.
 */
export function getAllowedPages(user: User): string[] {
  let pages: string[]

  switch (user.role) {
    case ADMIN:
      pages = [...ADMIN_PAGES]
      break
    case AGENT:
      pages = [...AGENT_PAGES]
      break
    default:
      pages = [...EMPLOYEE_PAGES]
      break
  }

  if (canViewBranchTickets(user)) {
    pages.push('my-branch')
  }
  if (canViewRegionTickets(user)) {
    pages.push('my-region')
  }

  return pages
}

// ============================================================================
// Public API: bulk ticket filtering
// ============================================================================

/**
 * Filter an array of tickets to only those visible to the given user.
 * This mirrors the prototype's `visibleTickets` computed value.
 */
export function filterVisibleTickets(
  user: User,
  tickets: Ticket[],
  allUsers: User[],
): Ticket[] {
  return tickets.filter((t) => canViewTicket(user, t, allUsers))
}

/**
 * Filter tickets to those whose creator or assignee belongs to the user's
 * managed branch.  Returns an empty array when the user lacks branch access.
 */
export function filterBranchTickets(
  user: User,
  tickets: Ticket[],
  allUsers: User[],
): Ticket[] {
  if (!user.hasBranchAccess || !user.managedBranchId) return []
  return tickets.filter((t) => ticketMatchesBranch(user, t, allUsers))
}

/**
 * Filter tickets to those whose creator or assignee belongs to the user's
 * managed region.  Returns an empty array when the user lacks region access.
 */
export function filterRegionTickets(
  user: User,
  tickets: Ticket[],
  allUsers: User[],
): Ticket[] {
  if (!user.hasRegionalAccess || !user.managedRegionId) return []
  return tickets.filter((t) => ticketMatchesRegion(user, t, allUsers))
}
