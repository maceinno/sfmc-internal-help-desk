/**
 * Decisions about WHEN an SLA alert is sent and WHO it goes to.
 *
 * Kept separate from the cron route so the rules are readable and testable
 * on their own — the route does the database work, this file holds the
 * judgement calls.
 */

/**
 * A breach older than this never produces a first-ever alert.
 *
 * The SLA job had never run successfully, so on the day it starts working
 * there is a backlog of tickets that went past their deadline days or weeks
 * ago (one was overdue by ten days). Emailing about those is not a warning,
 * it is a one-off blast about history the dashboard already shows — and it
 * would arrive at the worst possible moment, right as the feature is
 * switched on. Anything that breached inside this window still alerts once.
 *
 * Raise it (or set it to Infinity) to sweep up older breaches deliberately.
 */
export const STALE_BREACH_CUTOFF_HOURS = 48

export type SlaAlertStage = 'warning' | 'breach'

export type SlaAlertPlan =
  | { alert: true; stage: SlaAlertStage }
  | { alert: false; reason: 'within_sla' | 'stale_breach' }

/**
 * Which alert — if any — a ticket's current SLA state deserves.
 *
 * One warning as the deadline approaches, one notice if it passes, and
 * nothing otherwise. "Only once" is enforced separately, by the unique key
 * on the `sla_alerts` ledger; this function only decides what the ticket
 * qualifies for right now.
 */
export function planSlaAlert(p: {
  isAtRisk: boolean
  isOverdue: boolean
  slaDeadline: Date
  now?: number
  staleBreachCutoffHours?: number
}): SlaAlertPlan {
  const now = p.now ?? Date.now()

  if (p.isOverdue) {
    const cutoffHours = p.staleBreachCutoffHours ?? STALE_BREACH_CUTOFF_HOURS
    const overdueByMs = now - p.slaDeadline.getTime()
    if (
      Number.isFinite(cutoffHours) &&
      overdueByMs > cutoffHours * 60 * 60 * 1000
    ) {
      return { alert: false, reason: 'stale_breach' }
    }
    return { alert: true, stage: 'breach' }
  }

  if (p.isAtRisk) return { alert: true, stage: 'warning' }

  return { alert: false, reason: 'within_sla' }
}

/**
 * Who hears about an at-risk ticket that nobody has picked up: the same
 * audience as the "new ticket in <queue>" email. Lives in
 * `@/lib/tickets/queue-audience` because the department-move notification
 * needs exactly the same rule.
 */
export { eligibleQueueRecipients } from '@/lib/tickets/queue-audience'
export type { QueueMember } from '@/lib/tickets/queue-audience'
