import type { TicketStatus } from '@/types/ticket'

/**
 * What a reply does to its ticket's status.
 *
 * Two callers have to agree on this and used to state it separately: the
 * composer (which decides what to send) and POST /api/tickets/[id]/reply
 * (which decides whether to reopen). Keeping both rules here means a change
 * to one cannot silently disagree with the other.
 */

/**
 * Statuses that mean "an agent is waiting on somebody else". A public reply
 * from the requester or a CC is the thing being waited on, so it reopens the
 * ticket.
 *
 * `new` is deliberately NOT in this list. A ticket nobody has picked up yet
 * must stay in the unpicked queue when its own author adds a follow-up —
 * before 2026-09-22 the composer moved it to Open, which is what "tickets
 * come over as open instead of new" was.
 */
export const AGENT_WAITING_STATUSES: ReadonlyArray<TicketStatus> = [
  'solved',
  'pending',
  'on_hold',
]

/**
 * The status a reply carries, and whether its author declined the automatic
 * reopen.
 *
 * Agents and admins pick a status themselves. Employees have no status
 * control at all: their reply carries none, and the reopen is the API's
 * decision — except on a solved ticket, where "Send and keep it solved"
 * turns it off.
 */
export function replyStatusForRole(opts: {
  isAgentOrAdmin: boolean
  currentStatus: TicketStatus
  /** The agent's own pick. Ignored for employees. */
  agentPick: TicketStatus | null
  /** Employee's "keep it solved" choice. Only meaningful on a solved ticket. */
  keepSolved: boolean
}): { nextStatus: TicketStatus | null; keepStatus: boolean } {
  const { isAgentOrAdmin, currentStatus, agentPick, keepSolved } = opts

  if (isAgentOrAdmin) {
    return { nextStatus: agentPick, keepStatus: false }
  }

  return {
    nextStatus: null,
    keepStatus: currentStatus === 'solved' && keepSolved,
  }
}

/**
 * Should this reply flip the ticket back to `open`?
 *
 * Internal notes never do. Agent replies never do (they carry their own
 * status). A requester's public reply does, on the three agent-is-waiting
 * statuses, unless they asked to keep the current one.
 */
export function shouldAutoReopen(opts: {
  currentStatus: TicketStatus
  isInternalNote: boolean
  isAgentOrAdmin: boolean
  keepStatus: boolean
}): boolean {
  const { currentStatus, isInternalNote, isAgentOrAdmin, keepStatus } = opts

  if (isInternalNote) return false
  if (isAgentOrAdmin) return false
  if (keepStatus) return false

  return AGENT_WAITING_STATUSES.includes(currentStatus)
}
