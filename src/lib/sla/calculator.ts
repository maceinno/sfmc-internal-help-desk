import type {
  Ticket,
  TicketPriority,
  SlaPolicy,
  DepartmentSchedule,
} from '@/types/ticket';

import { findMatchingPolicy } from './policy-matcher';
import {
  calculateBusinessHoursDeadline,
  calculateBusinessHoursElapsed,
} from './business-hours';

// ── Legacy fallback config ───────────────────────────────────

export const SLA_CONFIG: Record<
  TicketPriority,
  { hours: number; label: string }
> = {
  urgent: { hours: 2, label: '2 Hours' },
  high: { hours: 4, label: '4 Hours' },
  medium: { hours: 8, label: '8 Hours' },
  low: { hours: 24, label: '24 Hours' },
};

// ── SLA Status interface ─────────────────────────────────────

export interface SlaStatus {
  isOverdue: boolean;
  isAtRisk: boolean;
  timeRemainingMs: number;
  slaDeadline: Date;
  percentUsed: number;
  warningThreshold: number;
  label: string;
  policyName?: string;
  metric: 'firstReply' | 'nextReply';
}

// ── Active Metric Detection ──────────────────────────────────

/**
 * Determine which SLA metric is currently active for a ticket.
 *
 * - `firstReply` when no non-internal, non-creator messages exist yet.
 * - `nextReply` once an agent has replied (anchored to the first
 *   end-user follow-up after the last agent reply, or to the last
 *   agent reply itself if there are no follow-ups).
 */
export function getActiveMetric(ticket: Ticket): {
  metric: 'firstReply' | 'nextReply';
  anchorTime: string;
} {
  const messages = ticket.messages ?? [];
  const agentReplies = messages.filter(
    (m) => !m.is_internal && m.author_id !== ticket.created_by,
  );

  if (agentReplies.length === 0) {
    return { metric: 'firstReply', anchorTime: ticket.created_at };
  }

  const lastAgentReply = agentReplies[agentReplies.length - 1];
  const endUserFollowUps = messages.filter(
    (m) =>
      !m.is_internal &&
      m.author_id === ticket.created_by &&
      new Date(m.created_at).getTime() >
        new Date(lastAgentReply.created_at).getTime(),
  );

  if (endUserFollowUps.length > 0) {
    return { metric: 'nextReply', anchorTime: endUserFollowUps[0].created_at };
  }

  return { metric: 'nextReply', anchorTime: lastAgentReply.created_at };
}

// ── Schedule lookup ──────────────────────────────────────────

function findScheduleForTicket(
  ticket: Ticket,
  schedules: DepartmentSchedule[],
): DepartmentSchedule | null {
  if (!ticket.ticket_type) return null;
  return (
    schedules.find(
      (s) => s.enabled && s.department_name === ticket.ticket_type,
    ) || null
  );
}

// ── Main SLA Status ──────────────────────────────────────────

/**
 * Compute the current SLA status for a ticket.
 *
 * When a matching policy and department schedule exist, business-hours-aware
 * calculations are used. Otherwise the system falls back to calendar-hours
 * or the legacy priority-based SLA.
 *
 * @returns `null` for solved tickets; an `SlaStatus` object otherwise.
 */
export function getSlaStatus(
  ticket: Ticket,
  policies?: SlaPolicy[],
  schedules?: DepartmentSchedule[],
): SlaStatus | null {
  if (ticket.status === 'solved') {
    return null;
  }

  const policy = policies ? findMatchingPolicy(ticket, policies) : null;

  if (!policy) {
    // Fallback to legacy priority-based SLA (no business hours)
    const createdAt = new Date(ticket.created_at).getTime();
    const slaHours = SLA_CONFIG[ticket.priority].hours;
    const slaDeadlineMs = createdAt + slaHours * 60 * 60 * 1000;
    const now = Date.now();
    const timeRemainingMs = slaDeadlineMs - now;
    const isOverdue = timeRemainingMs < 0;
    const totalDuration = slaHours * 60 * 60 * 1000;
    const timeElapsed = now - createdAt;
    let percentUsed = (timeElapsed / totalDuration) * 100;
    if (percentUsed < 0) percentUsed = 0;

    return {
      isOverdue,
      isAtRisk: !isOverdue && percentUsed >= 75,
      timeRemainingMs,
      slaDeadline: new Date(slaDeadlineMs),
      percentUsed,
      warningThreshold: 75,
      label: SLA_CONFIG[ticket.priority].label,
      metric: 'firstReply',
    };
  }

  // Policy-based SLA
  const { metric, anchorTime } = getActiveMetric(ticket);
  const slaHours =
    metric === 'firstReply'
      ? policy.metrics.firstReplyHours
      : policy.metrics.nextReplyHours;

  const anchorMs = new Date(anchorTime).getTime();
  const now = Date.now();

  const schedule = schedules
    ? findScheduleForTicket(ticket, schedules)
    : null;

  let slaDeadlineMs: number;
  let percentUsed: number;

  if (schedule) {
    // Business-hours-aware calculation
    slaDeadlineMs = calculateBusinessHoursDeadline(anchorMs, slaHours, schedule);
    const totalBusinessMs = slaHours * 60 * 60 * 1000;
    const elapsedBusinessMs = calculateBusinessHoursElapsed(
      anchorMs,
      now,
      schedule,
    );
    percentUsed = (elapsedBusinessMs / totalBusinessMs) * 100;
  } else {
    // Calendar-hours calculation (no schedule)
    slaDeadlineMs = anchorMs + slaHours * 60 * 60 * 1000;
    const totalDuration = slaHours * 60 * 60 * 1000;
    const timeElapsed = now - anchorMs;
    percentUsed = (timeElapsed / totalDuration) * 100;
  }

  if (percentUsed < 0) percentUsed = 0;

  const timeRemainingMs = slaDeadlineMs - now;
  const isOverdue = timeRemainingMs < 0;
  const warningThreshold = policy.metrics.warningThreshold ?? 75;

  return {
    isOverdue,
    isAtRisk: !isOverdue && percentUsed >= warningThreshold,
    timeRemainingMs,
    slaDeadline: new Date(slaDeadlineMs),
    percentUsed,
    warningThreshold,
    label: `${slaHours}h`,
    policyName: policy.name,
    metric,
  };
}

// ── Formatting ───────────────────────────────────────────────

/**
 * Convert a millisecond duration into a human-readable string.
 *
 * - Positive values: `"Xh Ym left"`
 * - Negative values: `"Overdue by Xh Ym"`
 */
export function formatTimeRemaining(ms: number): string {
  const isOverdue = ms < 0;
  const absMs = Math.abs(ms);

  const hours = Math.floor(absMs / (1000 * 60 * 60));
  const minutes = Math.floor((absMs % (1000 * 60 * 60)) / (1000 * 60));

  const timeString = `${hours}h ${minutes}m`;

  if (isOverdue) {
    return `Overdue by ${timeString}`;
  }
  return `${timeString} left`;
}

// ── Bulk helpers ─────────────────────────────────────────────

/** Return all tickets whose SLA is currently overdue. */
export function getOverdueTickets(
  tickets: Ticket[],
  policies?: SlaPolicy[],
  schedules?: DepartmentSchedule[],
): Ticket[] {
  return tickets.filter((ticket) => {
    const status = getSlaStatus(ticket, policies, schedules);
    return status && status.isOverdue;
  });
}

/** Return all tickets whose SLA is at risk but not yet overdue. */
export function getAtRiskTickets(
  tickets: Ticket[],
  policies?: SlaPolicy[],
  schedules?: DepartmentSchedule[],
): Ticket[] {
  return tickets.filter((ticket) => {
    const status = getSlaStatus(ticket, policies, schedules);
    return status && status.isAtRisk;
  });
}
