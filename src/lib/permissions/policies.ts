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
 * Return the effective set of managed branch IDs for a user.
 * Prefers the new `managed_branch_ids` array, falling back to the legacy
 * single `managed_branch_id` field for backward compatibility.
 *
 * Exported for the server-side gate (`assert-ticket-access.ts`), and
 * mirrored in the database by `get_user_branch_ids()` (migration 021) — the
 * three must agree, or a manager is shown a ticket they then cannot open or
 * reply to.
 */
export function getManagedBranchIds(
  user: Pick<User, 'managed_branch_ids' | 'managed_branch_id'>,
): string[] {
  if (user.managed_branch_ids && user.managed_branch_ids.length > 0) {
    return user.managed_branch_ids
  }
  if (user.managed_branch_id) {
    return [user.managed_branch_id]
  }
  return []
}

/**
 * Return true when the ticket's creator OR assignee belongs to one of the
 * user's managed branches.
 */
function ticketMatchesBranch(
  user: User,
  ticket: Ticket,
  allUsers: User[],
): boolean {
  if (!user.has_branch_access) return false
  const branchIds = getManagedBranchIds(user)
  if (branchIds.length === 0) return false

  const creator = allUsers.find((u) => u.id === ticket.created_by)
  const assignee = ticket.assigned_to
    ? allUsers.find((u) => u.id === ticket.assigned_to)
    : null

  return (
    (!!creator && !!creator.branch_id && branchIds.includes(creator.branch_id)) ||
    (!!assignee && !!assignee.branch_id && branchIds.includes(assignee.branch_id))
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
  if (!user.has_regional_access || !user.managed_region_id) return false

  const creator = allUsers.find((u) => u.id === ticket.created_by)
  const assignee = ticket.assigned_to
    ? allUsers.find((u) => u.id === ticket.assigned_to)
    : null

  return (
    (!!creator && creator.region_id === user.managed_region_id) ||
    (!!assignee && assignee.region_id === user.managed_region_id)
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
 *   - Agent: can view every ticket. Widened 2026-08-19 so agents can search
 *     and open tickets in other departments; mirrors migration 017 on the
 *     database side and the long-standing behaviour of
 *     `assert-ticket-access.ts`, which has always allowed any agent to act
 *     on any ticket. Keeping this narrower than the database would just
 *     hide tickets the user is in fact allowed to open.
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
  if (user.role === AGENT) return true

  // Employee
  if (ticket.created_by === user.id) return true
  if (ticket.cc?.includes(user.id)) return true

  if (user.has_regional_access || user.has_branch_access) {
    return (
      ticketMatchesRegion(user, ticket, allUsers) ||
      ticketMatchesBranch(user, ticket, allUsers)
    )
  }

  return false
}

/**
 * Is this ticket part of the user's own day-to-day queue?
 *
 * ACCESS AND BROWSING ARE DIFFERENT QUESTIONS, and this is the second one.
 * `canViewTicket` above answers "may they open it" — since 2026-08-19 that is
 * yes for any agent, so they can search across departments and open what they
 * find. But an agent's normal lists should NOT suddenly contain every
 * department: "All Unsolved" is a work queue, not an archive. This predicate
 * is the pre-widening rule, kept deliberately so browsing stays where it was
 * while search reaches everywhere.
 *
 * Use it for lists someone BROWSES (agent views, dashboard counts, reports).
 * Never use it to decide access — a ticket outside the queue scope is still
 * perfectly openable, and gating on this would resurrect the original problem.
 *
 * Rules:
 *   - Admin: everything, as before.
 *   - Agent: the ticket's team is one of theirs, OR they are the assignee,
 *     creator or CC, OR their branch/region access matches.
 *   - Employee: their own, CC'd, or branch/region matches.
 */
export function isTicketInQueueScope(
  user: User,
  ticket: Ticket,
  allUsers: User[],
): boolean {
  if (user.role === ADMIN) return true

  const isAssignee = ticket.assigned_to === user.id
  const isCreator = ticket.created_by === user.id
  const isCCd = ticket.cc?.includes(user.id) ?? false
  if (isAssignee || isCreator || isCCd) return true

  if (user.role === AGENT) {
    const userTeams = user.team_ids ?? []
    if (ticket.assigned_team && userTeams.includes(ticket.assigned_team)) {
      return true
    }
  }

  if (user.has_regional_access || user.has_branch_access) {
    return (
      ticketMatchesRegion(user, ticket, allUsers) ||
      ticketMatchesBranch(user, ticket, allUsers)
    )
  }

  return false
}

/** Narrow a ticket list to the user's own queue. See isTicketInQueueScope. */
export function filterQueueScope(
  user: User,
  tickets: Ticket[],
  allUsers: User[],
): Ticket[] {
  if (user.role === ADMIN) return tickets
  return tickets.filter((t) => isTicketInQueueScope(user, t, allUsers))
}

/**
 * Check if a user can edit / update a ticket.
 *
 * Rules:
 *   - Admin: always.
 *   - Agent: any ticket they can see (Zendesk-style — agents own the queue).
 *   - Employee: when they are the creator.
 */
export function canEditTicket(user: User, ticket: Ticket): boolean {
  if (user.role === ADMIN) return true
  if (user.role === AGENT) return true
  return ticket.created_by === user.id
}

/**
 * Can this user REMOVE people from the ticket's CC list? (Adding is the
 * wider `canAddCc` below since 2026-09-25; this doc predates that split.)
 *
 * Agents and admins, plus the person who raised the ticket. The requester is
 * included deliberately: they are usually the one who knows which colleague
 * also needs to see the request, and before 2026-08-19 the CC control simply
 * wasn't rendered for them, so a CC could only be set at creation time.
 *
 * This mirrors the server's 'manage' allow-list in `assert-ticket-access.ts`
 * (creator OR agent/admin) and the ticket_cc delete policy in the database
 * (creator, assignee or admin). Keep the three in step — a UI control that
 * the server then refuses is worse than no control at all.
 */
export function canManageCc(user: User, ticket: Ticket): boolean {
  if (user.role === ADMIN || user.role === AGENT) return true
  return ticket.created_by === user.id
}

/**
 * Can this user ADD someone to the ticket's CC list?
 *
 * Anyone who can see the ticket — the client's decision, 2026-09-25, after a
 * user who was looking at someone else's ticket reported the CC field
 * missing. Removing a CC is still `canManageCc` above (agents, admins, the
 * requester): adding someone only widens who hears about a ticket, removing
 * someone silently cuts a person off it.
 *
 * Deliberately takes no allow-list of its own. This is only ever asked on
 * the ticket page, which the database has already let this user open, so
 * "can see it" is already established; re-deriving it here (region, branch,
 * collaborator...) would just be a second copy to drift. The server route
 * enforces the same rule with `assertTicketAccess(..., 'respond')`.
 */
export function canAddCc(user: User, ticket: Ticket): boolean {
  // A signed-in user looking at a real ticket — nothing narrower.
  return Boolean(user.id) && Boolean(ticket.id)
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
  return !!user.has_branch_access && getManagedBranchIds(user).length > 0
}

/**
 * Check if a user can view region-filtered tickets (has regional manager access).
 */
export function canViewRegionTickets(user: User): boolean {
  return !!user.has_regional_access && !!user.managed_region_id
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
 * Filter tickets to those whose creator or assignee belongs to one of the
 * user's managed branches.  Returns an empty array when the user lacks branch access.
 */
export function filterBranchTickets(
  user: User,
  tickets: Ticket[],
  allUsers: User[],
): Ticket[] {
  if (!user.has_branch_access || getManagedBranchIds(user).length === 0) return []
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
  if (!user.has_regional_access || !user.managed_region_id) return []
  return tickets.filter((t) => ticketMatchesRegion(user, t, allUsers))
}
