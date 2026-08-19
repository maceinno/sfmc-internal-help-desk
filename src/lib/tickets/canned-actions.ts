import type { CannedResponseAction, TicketStatus } from '@/types/ticket'

/**
 * Ticket-column updates implied by a template's ("canned response") actions.
 *
 * `statusDecidedByCaller` exists to stop a template's status change being
 * silently overwritten a moment after it lands. The reply composer already
 * carries its own "Submit as <status>" decision, and the ticket page applies
 * that decision right after the reply posts. When both sides wrote a status,
 * the composer's default won and the template's `setStatus` was lost —
 * templates looked like they only inserted text.
 *
 * So exactly one side owns status per reply: when the caller states its
 * decision (including "no status change" → null), the template defers to it.
 * The composer is responsible for adopting the template's status when the
 * template is inserted, so deferring here still lands the template's intent
 * — and it goes through the normal status-change path, which records the
 * change in the conversation and fires notifications.
 */
export function cannedTicketUpdates(
  actions: CannedResponseAction | null | undefined,
  { statusDecidedByCaller }: { statusDecidedByCaller: boolean },
): Record<string, unknown> {
  const updates: Record<string, unknown> = {}
  if (!actions) return updates

  if (actions.setStatus && !statusDecidedByCaller) {
    updates.status = actions.setStatus
  }
  if (actions.setPriority) {
    updates.priority = actions.setPriority
  }
  if (actions.setTeam) {
    updates.assigned_team = actions.setTeam
  }

  return updates
}

/**
 * The status the composer should pre-select when a template is inserted.
 * `null` means "leave the current selection alone" — templates without a
 * status action must not disturb what the agent already chose.
 */
export function statusFromCannedResponse(
  actions: CannedResponseAction | null | undefined,
): TicketStatus | null {
  return actions?.setStatus ?? null
}
