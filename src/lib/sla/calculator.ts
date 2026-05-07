import type {
  Ticket,
  SlaPolicy,
  DepartmentSchedule,
  Message,
} from '@/types/ticket';

import { findMatchingPolicy } from './policy-matcher';
import {
  calculateBusinessHoursDeadline,
  calculateBusinessHoursElapsed,
} from './business-hours';

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
 * Whether a message represents an "agent reply" — i.e. a public message
 * whose author has role agent or admin. Internal notes and system events
 * are never agent replies.
 *
 * Prefers the joined `author_role` (populated when the fetch query includes
 * `profiles(role)`) for an authoritative answer. Falls back to the legacy
 * proxy `author_id !== created_by` when role data isn't available — that
 * misclassifies two cases (an agent who creates and replies to their own
 * ticket; a CC'd colleague replying), but is what the system did pre-fix
 * and is the right safe default for callers and tests that don't fetch
 * role data.
 */
function isAgentReply(m: Message, ticketCreatedBy: string): boolean {
  if (m.is_internal || m.is_system) return false;
  if (m.author_role === 'agent' || m.author_role === 'admin') return true;
  if (m.author_role === 'employee') return false;
  return m.author_id !== ticketCreatedBy;
}

/**
 * Whether a message represents an end-user reply — anything public that
 * isn't an agent reply. With role data, this correctly includes CC'd
 * colleagues' comments (they also have role `employee`); without role data
 * it falls back to the legacy "creator only" proxy.
 */
function isEndUserReply(m: Message, ticketCreatedBy: string): boolean {
  if (m.is_internal || m.is_system) return false;
  return !isAgentReply(m, ticketCreatedBy);
}

/**
 * Determine which SLA metric is currently active for a ticket.
 *
 * - `firstReply` when no agent reply exists yet.
 * - `nextReply` once an agent has replied (anchored to the first
 *   end-user follow-up after the last agent reply, or to the last
 *   agent reply itself if there are no follow-ups).
 */
export function getActiveMetric(ticket: Ticket): {
  metric: 'firstReply' | 'nextReply';
  anchorTime: string;
} {
  const messages = ticket.messages ?? [];
  const agentReplies = messages.filter((m) => isAgentReply(m, ticket.created_by));

  if (agentReplies.length === 0) {
    return { metric: 'firstReply', anchorTime: ticket.created_at };
  }

  const lastAgentReply = agentReplies[agentReplies.length - 1];
  const lastAgentReplyMs = new Date(lastAgentReply.created_at).getTime();
  const endUserFollowUps = messages.filter(
    (m) =>
      isEndUserReply(m, ticket.created_by) &&
      new Date(m.created_at).getTime() > lastAgentReplyMs,
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
  // Case-insensitive match: a typo or case drift between admin/categories
  // and admin/schedules used to silently fall through to 24/7 calendar.
  const target = ticket.ticket_type.toLowerCase();
  return (
    schedules.find(
      (s) => s.enabled && s.department_name.toLowerCase() === target,
    ) || null
  );
}

// ── Main SLA Status ──────────────────────────────────────────

/**
 * Compute the current SLA status for a ticket.
 *
 * Returns `null` (no SLA badge) when:
 *   - the ticket is solved,
 *   - no SLA policy matches (admin must configure a catch-all if they
 *     want a default for everything),
 *   - or the matched policy has the active metric set to N/A
 *     (e.g. `nextReplyHours: null` while we're tracking next-reply).
 *
 * When a department schedule is provided, business-hours-aware
 * calculations are used; otherwise calendar hours.
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

  // No policy matches → no SLA. Admins can opt into a global default by
  // creating a catch-all policy (any/any/any). We deliberately do NOT
  // fall back to a hardcoded priority table — that would mask "I turned
  // it off" and silently apply phantom deadlines.
  if (!policy) {
    return null;
  }

  // Policy-based SLA
  const { metric, anchorTime } = getActiveMetric(ticket);

  // Per-priority overrides take precedence over the top-level metrics.
  // `undefined` means "no override at this priority — fall back to top-level".
  // `null` means "explicitly disabled for this priority".
  const perPri = policy.metrics.perPriority?.[ticket.priority];
  const overrideHours =
    metric === 'firstReply' ? perPri?.firstReplyHours : perPri?.nextReplyHours;
  const slaHours =
    overrideHours !== undefined
      ? overrideHours
      : metric === 'firstReply'
        ? policy.metrics.firstReplyHours
        : policy.metrics.nextReplyHours;

  // Metric explicitly set to N/A on this policy → not tracked.
  if (slaHours === null || slaHours === undefined) {
    return null;
  }

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

  // `timeRemainingMs` must match the calendar/business-hours mode used for
  // the deadline and percentUsed. Without this, the deadline is correctly
  // pushed past nights/weekends but the displayed countdown still ticks
  // down through them — looks like the SLA "doesn't pause" even though
  // the deadline does.
  let timeRemainingMs: number;
  if (schedule) {
    timeRemainingMs =
      now < slaDeadlineMs
        ? calculateBusinessHoursElapsed(now, slaDeadlineMs, schedule)
        : -calculateBusinessHoursElapsed(slaDeadlineMs, now, schedule);
  } else {
    timeRemainingMs = slaDeadlineMs - now;
  }
  const isOverdue = now >= slaDeadlineMs;
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
 * - Under 24h: `"Xh Ym"` (e.g. `"3h 15m left"`, `"Overdue by 1h 45m"`)
 * - At or over 24h: `"Xd Yh"` (e.g. `"2d 5h left"`, `"Overdue by 136d 14h"`)
 *
 * Days are 24-hour units, not "business days" — when a schedule is in
 * play, `ms` carries business-hours-elapsed and the conversion just
 * scales it to a more readable magnitude. So "136d 14h overdue" really
 * means 3278 hours of accumulated business overdue time, which on an
 * M-F 8:30-5:30 schedule corresponds to roughly 17 calendar months.
 */
export function formatTimeRemaining(ms: number): string {
  const isOverdue = ms < 0;
  const absMs = Math.abs(ms);

  const HOUR = 1000 * 60 * 60;
  const DAY = 24 * HOUR;

  let timeString: string;
  if (absMs >= DAY) {
    const days = Math.floor(absMs / DAY);
    const hours = Math.floor((absMs % DAY) / HOUR);
    timeString = `${days}d ${hours}h`;
  } else {
    const hours = Math.floor(absMs / HOUR);
    const minutes = Math.floor((absMs % HOUR) / (1000 * 60));
    timeString = `${hours}h ${minutes}m`;
  }

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
