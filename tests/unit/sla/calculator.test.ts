import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  Ticket,
  SlaPolicy,
  DepartmentSchedule,
} from '@/types/ticket';
import { findMatchingPolicy } from '@/lib/sla/policy-matcher';
import {
  isHoliday,
  calculateBusinessHoursDeadline,
  calculateBusinessHoursElapsed,
} from '@/lib/sla/business-hours';
import {
  getActiveMetric,
  getSlaStatus,
  formatTimeRemaining,
  getOverdueTickets,
  getAtRiskTickets,
} from '@/lib/sla/calculator';

// ── Test Fixtures ────────────────────────────────────────────

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 'T-001',
    title: 'Test ticket',
    description: 'A test',
    status: 'open',
    priority: 'medium',
    category: 'General',
    created_by: 'user-1',
    created_at: '2025-06-01T09:00:00Z',
    updated_at: '2025-06-01T09:00:00Z',
    messages: [],
    ...overrides,
  };
}

function makePolicy(overrides: Partial<SlaPolicy> = {}): SlaPolicy {
  return {
    id: 'pol-1',
    name: 'Standard Policy',
    enabled: true,
    conditions: {
      ticketTypes: 'any',
      categories: 'any',
      priorities: 'any',
    },
    metrics: {
      firstReplyHours: 4,
      nextReplyHours: 8,
    },
    sort_sort_order: 1,
    ...overrides,
  };
}

function makeSchedule(
  overrides: Partial<DepartmentSchedule> = {},
): DepartmentSchedule {
  return {
    id: 'sched-1',
    department_name: 'IT Support',
    timezone: 'America/New_York',
    business_hours: [
      { day: 'monday', enabled: true, startTime: '08:00', endTime: '17:00' },
      { day: 'tuesday', enabled: true, startTime: '08:00', endTime: '17:00' },
      { day: 'wednesday', enabled: true, startTime: '08:00', endTime: '17:00' },
      { day: 'thursday', enabled: true, startTime: '08:00', endTime: '17:00' },
      { day: 'friday', enabled: true, startTime: '08:00', endTime: '17:00' },
      { day: 'saturday', enabled: false, startTime: '08:00', endTime: '17:00' },
      { day: 'sunday', enabled: false, startTime: '08:00', endTime: '17:00' },
    ],
    holidays: [
      { id: 'h-1', name: 'Independence Day', date: '2025-07-04' },
    ],
    enabled: true,
    ...overrides,
  };
}

// ── findMatchingPolicy ───────────────────────────────────────

describe('findMatchingPolicy', () => {
  it('returns the correct policy based on ticket type, category, and priority', () => {
    const itPolicy = makePolicy({
      id: 'pol-it',
      name: 'IT Policy',
      conditions: {
        ticketTypes: ['IT Support'],
        categories: ['IT Systems'],
        priorities: ['urgent', 'high'],
      },
      sort_order: 1,
    });

    const generalPolicy = makePolicy({
      id: 'pol-gen',
      name: 'General Policy',
      sort_order: 2,
    });

    const ticket = makeTicket({
      ticket_type: 'IT Support',
      category: 'IT Systems',
      priority: 'urgent',
    });

    const result = findMatchingPolicy(ticket, [generalPolicy, itPolicy]);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('pol-it');
  });

  it('returns null when no policy matches', () => {
    const policy = makePolicy({
      conditions: {
        ticketTypes: ['Closing Support'],
        categories: ['Closing'],
        priorities: ['urgent'],
      },
    });

    const ticket = makeTicket({
      ticket_type: 'IT Support',
      category: 'IT Systems',
      priority: 'low',
    });

    expect(findMatchingPolicy(ticket, [policy])).toBeNull();
  });

  it('skips disabled policies', () => {
    const disabledPolicy = makePolicy({
      id: 'pol-disabled',
      enabled: false,
      sort_order: 1,
    });
    const enabledPolicy = makePolicy({
      id: 'pol-enabled',
      enabled: true,
      sort_order: 2,
    });

    const ticket = makeTicket();
    const result = findMatchingPolicy(ticket, [disabledPolicy, enabledPolicy]);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('pol-enabled');
  });

  it('evaluates policies in order and returns the first match', () => {
    const firstPolicy = makePolicy({ id: 'pol-first', sort_order: 1 });
    const secondPolicy = makePolicy({ id: 'pol-second', sort_order: 2 });

    const ticket = makeTicket();
    const result = findMatchingPolicy(ticket, [secondPolicy, firstPolicy]);
    expect(result!.id).toBe('pol-first');
  });

  it('matches subcategory conditions when specified', () => {
    const policy = makePolicy({
      conditions: {
        ticketTypes: 'any',
        categories: 'any',
        priorities: 'any',
        subCategories: ['Early Release'],
      },
    });

    const matchingTicket = makeTicket({ sub_category: 'Early Release' });
    const nonMatchingTicket = makeTicket({ sub_category: 'Other' });
    const noSubCatTicket = makeTicket();

    expect(findMatchingPolicy(matchingTicket, [policy])).not.toBeNull();
    expect(findMatchingPolicy(nonMatchingTicket, [policy])).toBeNull();
    expect(findMatchingPolicy(noSubCatTicket, [policy])).toBeNull();
  });
});

// ── getActiveMetric ──────────────────────────────────────────

describe('getActiveMetric', () => {
  it('returns "firstReply" when no non-creator messages exist', () => {
    const ticket = makeTicket({
      created_at: '2025-06-01T09:00:00Z',
      messages: [],
    });

    const result = getActiveMetric(ticket);
    expect(result.metric).toBe('firstReply');
    expect(result.anchorTime).toBe('2025-06-01T09:00:00Z');
  });

  it('returns "firstReply" when only internal messages exist', () => {
    const ticket = makeTicket({
      messages: [
        {
          id: 'm-1',
          author_id: 'agent-1',
          content: 'Internal note',
          created_at: '2025-06-01T10:00:00Z',
          is_internal: true,
        },
      ],
    });

    const result = getActiveMetric(ticket);
    expect(result.metric).toBe('firstReply');
  });

  it('returns "nextReply" after an agent replies publicly', () => {
    const ticket = makeTicket({
      created_by: 'user-1',
      messages: [
        {
          id: 'm-1',
          author_id: 'agent-1',
          content: 'Agent reply',
          created_at: '2025-06-01T10:00:00Z',
          is_internal: false,
        },
      ],
    });

    const result = getActiveMetric(ticket);
    expect(result.metric).toBe('nextReply');
  });

  it('anchors to end-user follow-up after last agent reply', () => {
    const ticket = makeTicket({
      created_by: 'user-1',
      messages: [
        {
          id: 'm-1',
          author_id: 'agent-1',
          content: 'Agent reply',
          created_at: '2025-06-01T10:00:00Z',
          is_internal: false,
        },
        {
          id: 'm-2',
          author_id: 'user-1',
          content: 'Follow-up question',
          created_at: '2025-06-01T11:00:00Z',
          is_internal: false,
        },
      ],
    });

    const result = getActiveMetric(ticket);
    expect(result.metric).toBe('nextReply');
    expect(result.anchorTime).toBe('2025-06-01T11:00:00Z');
  });
});

// ── getActiveMetric — role-based agent detection ─────────────

describe('getActiveMetric (role-based agent detection)', () => {
  it('treats an agent reply on their own ticket as an agent reply', () => {
    // Agent files a ticket as themselves and follows up. Legacy heuristic
    // (author_id !== created_by) misses this — author_id === created_by.
    // Role-based detection catches it.
    const ticket = makeTicket({
      created_by: 'agent-1',
      messages: [
        {
          id: 'm-1',
          author_id: 'agent-1',
          content: 'Public update from the agent who filed the ticket',
          created_at: '2025-06-01T10:00:00Z',
          is_internal: false,
          author_role: 'agent',
        },
      ],
    });

    const result = getActiveMetric(ticket);
    expect(result.metric).toBe('nextReply');
    expect(result.anchorTime).toBe('2025-06-01T10:00:00Z');
  });

  it('does NOT treat a CC\'d colleague\'s reply as an agent reply', () => {
    // CC'd colleague has role 'employee'. Legacy heuristic flips to
    // nextReply because author_id !== created_by; role-based detection
    // correctly keeps it on firstReply until a real agent replies.
    const ticket = makeTicket({
      created_by: 'user-1',
      messages: [
        {
          id: 'm-1',
          author_id: 'user-2',
          content: 'A CC\'d colleague chiming in',
          created_at: '2025-06-01T10:00:00Z',
          is_internal: false,
          author_role: 'employee',
        },
      ],
    });

    const result = getActiveMetric(ticket);
    expect(result.metric).toBe('firstReply');
    expect(result.anchorTime).toBe(ticket.created_at);
  });

  it('admin-role replies count as agent replies', () => {
    const ticket = makeTicket({
      created_by: 'user-1',
      messages: [
        {
          id: 'm-1',
          author_id: 'admin-1',
          content: 'Admin response',
          created_at: '2025-06-01T10:00:00Z',
          is_internal: false,
          author_role: 'admin',
        },
      ],
    });

    expect(getActiveMetric(ticket).metric).toBe('nextReply');
  });

  it('a CC\'d colleague\'s comment after an agent reply anchors nextReply', () => {
    // Pre-fix, only the original creator's follow-ups counted; a CC'd
    // colleague replying after an agent reply was invisible to the SLA
    // anchor. With role data, any non-agent comment after the last agent
    // reply anchors nextReply.
    const ticket = makeTicket({
      created_by: 'user-1',
      messages: [
        {
          id: 'm-1',
          author_id: 'agent-1',
          content: 'Agent reply',
          created_at: '2025-06-01T10:00:00Z',
          is_internal: false,
          author_role: 'agent',
        },
        {
          id: 'm-2',
          author_id: 'user-2', // CC'd colleague, NOT the creator
          content: 'Thanks, one more question…',
          created_at: '2025-06-01T11:00:00Z',
          is_internal: false,
          author_role: 'employee',
        },
      ],
    });

    const result = getActiveMetric(ticket);
    expect(result.metric).toBe('nextReply');
    expect(result.anchorTime).toBe('2025-06-01T11:00:00Z');
  });

  it('falls back to author_id !== created_by when author_role is missing', () => {
    // Backward compat: callers/tests that don't fetch role data still get
    // the pre-fix behavior (legacy proxy).
    const ticket = makeTicket({
      created_by: 'user-1',
      messages: [
        {
          id: 'm-1',
          author_id: 'someone-else',
          content: 'Public reply from non-creator, no role data',
          created_at: '2025-06-01T10:00:00Z',
          is_internal: false,
          // author_role intentionally omitted
        },
      ],
    });

    expect(getActiveMetric(ticket).metric).toBe('nextReply');
  });

  it('ignores internal notes regardless of author role', () => {
    const ticket = makeTicket({
      created_by: 'user-1',
      messages: [
        {
          id: 'm-1',
          author_id: 'agent-1',
          content: 'Internal note',
          created_at: '2025-06-01T10:00:00Z',
          is_internal: true,
          author_role: 'agent',
        },
      ],
    });

    expect(getActiveMetric(ticket).metric).toBe('firstReply');
  });
});

// ── formatTimeRemaining ──────────────────────────────────────

describe('formatTimeRemaining', () => {
  it('shows "Xh Ym left" for positive values', () => {
    // 2 hours and 30 minutes in ms
    const ms = 2 * 60 * 60 * 1000 + 30 * 60 * 1000;
    expect(formatTimeRemaining(ms)).toBe('2h 30m left');
  });

  it('shows "Overdue by Xh Ym" for negative values', () => {
    const ms = -(1 * 60 * 60 * 1000 + 15 * 60 * 1000);
    expect(formatTimeRemaining(ms)).toBe('Overdue by 1h 15m');
  });

  it('shows "0h 0m left" for exactly zero', () => {
    expect(formatTimeRemaining(0)).toBe('0h 0m left');
  });

  it('handles large durations', () => {
    const ms = 48 * 60 * 60 * 1000 + 5 * 60 * 1000;
    expect(formatTimeRemaining(ms)).toBe('48h 5m left');
  });
});

// ── getSlaStatus ─────────────────────────────────────────────

describe('getSlaStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null for solved tickets', () => {
    const ticket = makeTicket({ status: 'solved' });
    expect(getSlaStatus(ticket)).toBeNull();
  });

  it('correctly identifies overdue tickets via a catch-all policy', () => {
    const created_at = '2025-06-01T09:00:00Z';
    const ticket = makeTicket({ priority: 'urgent', created_at });
    const urgentPolicy = makePolicy({
      metrics: { firstReplyHours: 2, nextReplyHours: 4 },
    });

    // 2h SLA. Set clock 3 hours after creation.
    const createdMs = new Date(created_at).getTime();
    vi.setSystemTime(new Date(createdMs + 3 * 60 * 60 * 1000));

    const status = getSlaStatus(ticket, [urgentPolicy]);
    expect(status).not.toBeNull();
    expect(status!.isOverdue).toBe(true);
    expect(status!.timeRemainingMs).toBeLessThan(0);
  });

  it('correctly identifies at-risk tickets via a catch-all policy', () => {
    const created_at = '2025-06-01T09:00:00Z';
    const ticket = makeTicket({ priority: 'medium', created_at });
    const mediumPolicy = makePolicy({
      metrics: { firstReplyHours: 8, nextReplyHours: 16 },
    });

    // 8h SLA. Set clock at 7 hours (87.5% used, > 75% threshold).
    const createdMs = new Date(created_at).getTime();
    vi.setSystemTime(new Date(createdMs + 7 * 60 * 60 * 1000));

    const status = getSlaStatus(ticket, [mediumPolicy]);
    expect(status).not.toBeNull();
    expect(status!.isOverdue).toBe(false);
    expect(status!.isAtRisk).toBe(true);
  });

  it('uses policy-based calculation when policies are provided', () => {
    const created_at = '2025-06-01T09:00:00Z';
    const ticket = makeTicket({
      priority: 'high',
      created_at,
      ticket_type: 'IT Support',
    });

    const policy = makePolicy({
      conditions: {
        ticketTypes: ['IT Support'],
        categories: 'any',
        priorities: 'any',
      },
      metrics: {
        firstReplyHours: 2,
        nextReplyHours: 4,
      },
    });

    // Set clock 3 hours after creation -> overdue on firstReply (2h)
    const createdMs = new Date(created_at).getTime();
    vi.setSystemTime(new Date(createdMs + 3 * 60 * 60 * 1000));

    const status = getSlaStatus(ticket, [policy]);
    expect(status).not.toBeNull();
    expect(status!.isOverdue).toBe(true);
    expect(status!.metric).toBe('firstReply');
    expect(status!.policyName).toBe('Standard Policy');
  });

  it('reports non-overdue status when within SLA window', () => {
    const created_at = '2025-06-01T09:00:00Z';
    const ticket = makeTicket({ priority: 'low', created_at });
    const lowPolicy = makePolicy({
      metrics: { firstReplyHours: 24, nextReplyHours: 48 },
    });

    // 24h SLA. Set clock 1 hour after creation.
    const createdMs = new Date(created_at).getTime();
    vi.setSystemTime(new Date(createdMs + 1 * 60 * 60 * 1000));

    const status = getSlaStatus(ticket, [lowPolicy]);
    expect(status).not.toBeNull();
    expect(status!.isOverdue).toBe(false);
    expect(status!.isAtRisk).toBe(false);
    expect(status!.timeRemainingMs).toBeGreaterThan(0);
  });

  it('uses business hours when schedule is provided', () => {
    // Wednesday 2025-06-04 at 15:00 UTC
    const created_at = '2025-06-04T15:00:00.000Z';
    const ticket = makeTicket({
      priority: 'high',
      created_at,
      ticket_type: 'IT Support',
    });

    const policy = makePolicy({
      conditions: {
        ticketTypes: ['IT Support'],
        categories: 'any',
        priorities: 'any',
      },
      metrics: {
        firstReplyHours: 4,
        nextReplyHours: 8,
      },
    });

    const schedule = makeSchedule();

    // Set clock at creation time so we can check the deadline
    vi.setSystemTime(new Date(created_at));

    const status = getSlaStatus(ticket, [policy], [schedule]);
    expect(status).not.toBeNull();
    expect(status!.policyName).toBe('Standard Policy');
    // The deadline should be calculated via business hours
    expect(status!.slaDeadline).toBeInstanceOf(Date);
  });

  it('per-priority overrides take precedence over top-level metrics', () => {
    const created_at = '2025-06-01T09:00:00Z';
    const urgentTicket = makeTicket({ priority: 'urgent', created_at });
    const lowTicket = makeTicket({ priority: 'low', created_at });

    const policy = makePolicy({
      metrics: {
        firstReplyHours: 8,
        nextReplyHours: 16,
        perPriority: {
          urgent: { firstReplyHours: 1 },
          // low: deliberately absent → falls back to top-level 8h
        },
      },
    });

    // Set clock 90 minutes after creation:
    // - urgent's 1h SLA → overdue
    // - low's 8h SLA → not overdue
    const createdMs = new Date(created_at).getTime();
    vi.setSystemTime(new Date(createdMs + 90 * 60 * 1000));

    const urgentStatus = getSlaStatus(urgentTicket, [policy]);
    expect(urgentStatus!.isOverdue).toBe(true);

    const lowStatus = getSlaStatus(lowTicket, [policy]);
    expect(lowStatus!.isOverdue).toBe(false);
  });

  it('per-priority null disables tracking at that priority', () => {
    const created_at = '2025-06-01T09:00:00Z';
    const ticket = makeTicket({ priority: 'low', created_at });
    const policy = makePolicy({
      metrics: {
        firstReplyHours: 8,
        nextReplyHours: 16,
        perPriority: {
          low: { firstReplyHours: null },
        },
      },
    });

    vi.setSystemTime(new Date(created_at));

    // firstReplyHours resolved to null → metric returns null → no SLA.
    expect(getSlaStatus(ticket, [policy])).toBeNull();
  });
});

// ── getOverdueTickets / getAtRiskTickets ─────────────────────

describe('getOverdueTickets / getAtRiskTickets', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Per-priority policies that mirror the legacy hardcoded SLA table
  // (urgent 2h / high 4h / medium 8h / low 24h). Used to drive the
  // bulk-filter helpers that take a tickets array + policies array.
  const priorityPolicies: SlaPolicy[] = [
    makePolicy({
      id: 'pol-urgent',
      conditions: { ticketTypes: 'any', categories: 'any', priorities: ['urgent'] },
      metrics: { firstReplyHours: 2, nextReplyHours: 4 },
      sort_order: 1,
    }),
    makePolicy({
      id: 'pol-medium',
      conditions: { ticketTypes: 'any', categories: 'any', priorities: ['medium'] },
      metrics: { firstReplyHours: 8, nextReplyHours: 16 },
      sort_order: 2,
    }),
    makePolicy({
      id: 'pol-low',
      conditions: { ticketTypes: 'any', categories: 'any', priorities: ['low'] },
      metrics: { firstReplyHours: 24, nextReplyHours: 48 },
      sort_order: 3,
    }),
  ];

  it('getOverdueTickets filters only overdue tickets', () => {
    const baseTime = new Date('2025-06-01T09:00:00Z').getTime();
    vi.setSystemTime(new Date(baseTime + 3 * 60 * 60 * 1000));

    const overdueTicket = makeTicket({
      id: 'T-overdue',
      priority: 'urgent', // 2h SLA
      created_at: '2025-06-01T09:00:00Z',
    });
    const okTicket = makeTicket({
      id: 'T-ok',
      priority: 'low', // 24h SLA
      created_at: '2025-06-01T09:00:00Z',
    });

    const result = getOverdueTickets([overdueTicket, okTicket], priorityPolicies);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('T-overdue');
  });

  it('getAtRiskTickets filters only at-risk tickets', () => {
    const baseTime = new Date('2025-06-01T09:00:00Z').getTime();
    // 7 hours in: medium (8h) is at risk (87.5%), low (24h) is fine
    vi.setSystemTime(new Date(baseTime + 7 * 60 * 60 * 1000));

    const atRiskTicket = makeTicket({
      id: 'T-risk',
      priority: 'medium', // 8h SLA, 87.5% used
      created_at: '2025-06-01T09:00:00Z',
    });
    const safeTicket = makeTicket({
      id: 'T-safe',
      priority: 'low', // 24h SLA, 29% used
      created_at: '2025-06-01T09:00:00Z',
    });

    const result = getAtRiskTickets([atRiskTicket, safeTicket], priorityPolicies);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('T-risk');
  });
});

// ── Business Hours ───────────────────────────────────────────

describe('Business hours calculations', () => {
  // Use UTC throughout so the tests are reproducible regardless of the
  // runner's TZ. `new Date(2025, M, D, H)` interprets in local time and
  // would produce different results on a developer's machine vs. CI
  // (which runs in UTC). Pin both the schedule and the inputs to UTC.
  const utcSchedule = (
    overrides: Partial<DepartmentSchedule> = {},
  ): DepartmentSchedule => makeSchedule({ timezone: 'UTC', ...overrides });

  it('calculateBusinessHoursDeadline skips non-business hours', () => {
    const schedule = utcSchedule();

    // Friday 2025-06-06 at 16:00 UTC (1 hour before close)
    // Requesting 4 business hours: 1h Friday + 3h Monday = Monday 11:00 UTC
    const friday4pm = Date.UTC(2025, 5, 6, 16, 0, 0);
    const deadline = calculateBusinessHoursDeadline(friday4pm, 4, schedule);
    const deadlineDate = new Date(deadline);

    expect(deadlineDate.getUTCDay()).toBe(1); // Monday
    expect(deadlineDate.getUTCHours()).toBe(11);
    expect(deadlineDate.getUTCMinutes()).toBe(0);
  });

  it('calculateBusinessHoursElapsed counts only business hours', () => {
    const schedule = utcSchedule();

    // Friday 2025-06-06 16:00 UTC → Monday 2025-06-09 10:00 UTC
    // Business time: 1h (Fri 16-17) + 2h (Mon 08-10) = 3h
    const fridayStart = Date.UTC(2025, 5, 6, 16, 0, 0);
    const mondayEnd = Date.UTC(2025, 5, 9, 10, 0, 0);
    const elapsed = calculateBusinessHoursElapsed(fridayStart, mondayEnd, schedule);

    expect(elapsed).toBe(3 * 60 * 60 * 1000);
  });

  it('calculateBusinessHoursDeadline skips holidays', () => {
    const schedule = utcSchedule({
      holidays: [
        { id: 'h-1', name: 'Test Holiday', date: '2025-06-05' },
      ],
    });

    // Wednesday 2025-06-04 at 16:00 UTC (1h left in day)
    // Thursday 2025-06-05 is a holiday -> skip
    // Friday 2025-06-06 starts at 08:00 UTC, need 3 more hours -> 11:00 UTC
    const wed4pm = Date.UTC(2025, 5, 4, 16, 0, 0);
    const deadline = calculateBusinessHoursDeadline(wed4pm, 4, schedule);
    const deadlineDate = new Date(deadline);

    expect(deadlineDate.getUTCDate()).toBe(6); // Friday
    expect(deadlineDate.getUTCHours()).toBe(11);
  });
});

// ── isHoliday ────────────────────────────────────────────────

describe('isHoliday', () => {
  // isHoliday defaults to a UTC timezone when none is passed, so the
  // input Date must also be constructed in UTC for the comparison to
  // be reproducible across runner timezones.
  it('detects holidays correctly', () => {
    const holidays = [
      { date: '2025-07-04' },
      { date: '2025-12-25' },
    ];

    expect(isHoliday(new Date(Date.UTC(2025, 6, 4)), holidays)).toBe(true);
    expect(isHoliday(new Date(Date.UTC(2025, 11, 25)), holidays)).toBe(true);
  });

  it('returns false for non-holidays', () => {
    const holidays = [{ date: '2025-07-04' }];
    expect(isHoliday(new Date(Date.UTC(2025, 6, 3)), holidays)).toBe(false);
    expect(isHoliday(new Date(Date.UTC(2025, 6, 5)), holidays)).toBe(false);
  });

  it('returns false for an empty holiday list', () => {
    expect(isHoliday(new Date(2025, 0, 1), [])).toBe(false);
  });
});

// ── timeRemainingMs pauses outside business hours ────────────

describe('getSlaStatus timeRemainingMs (business-hours-aware)', () => {
  // Pin both the schedule and the inputs to UTC so the test is reproducible
  // regardless of the runner's local timezone.
  const utcSchedule: DepartmentSchedule = {
    id: 'sched-utc',
    department_name: 'IT Support',
    timezone: 'UTC',
    business_hours: [
      { day: 'monday', enabled: true, startTime: '08:00', endTime: '17:00' },
      { day: 'tuesday', enabled: true, startTime: '08:00', endTime: '17:00' },
      { day: 'wednesday', enabled: true, startTime: '08:00', endTime: '17:00' },
      { day: 'thursday', enabled: true, startTime: '08:00', endTime: '17:00' },
      { day: 'friday', enabled: true, startTime: '08:00', endTime: '17:00' },
      { day: 'saturday', enabled: false, startTime: '08:00', endTime: '17:00' },
      { day: 'sunday', enabled: false, startTime: '08:00', endTime: '17:00' },
    ],
    holidays: [],
    enabled: true,
  };

  // Anchor: Friday 2025-06-06 16:00 UTC (1h before close).
  // 4h SLA → deadline = Monday 2025-06-09 11:00 UTC (1h Fri + 3h Mon).
  const anchor = '2025-06-06T16:00:00.000Z';
  const ticket: Ticket = {
    id: 'T-bh',
    title: 't',
    description: 'd',
    status: 'open',
    priority: 'medium',
    category: 'General',
    ticket_type: 'IT Support',
    created_by: 'user-1',
    created_at: anchor,
    updated_at: anchor,
    messages: [],
  };
  const policy: SlaPolicy = {
    id: 'p',
    name: 'Std',
    enabled: true,
    conditions: { ticketTypes: 'any', categories: 'any', priorities: 'any' },
    metrics: { firstReplyHours: 4, nextReplyHours: 8 },
    sort_order: 1,
  };

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('countdown stays the same across an overnight gap', () => {
    // Friday 17:00 UTC — exactly at close, 1h business elapsed.
    vi.setSystemTime(new Date(Date.UTC(2025, 5, 6, 17, 0, 0)));
    const friClose = getSlaStatus(ticket, [policy], [utcSchedule])!;

    // Saturday noon UTC — non-business hours.
    vi.setSystemTime(new Date(Date.UTC(2025, 5, 7, 12, 0, 0)));
    const satNoon = getSlaStatus(ticket, [policy], [utcSchedule])!;

    // Same business-hours-remaining at both points (no business time
    // elapsed during the gap).
    expect(satNoon.timeRemainingMs).toBe(friClose.timeRemainingMs);
    expect(friClose.timeRemainingMs).toBe(3 * 60 * 60 * 1000); // 3h
    expect(satNoon.isOverdue).toBe(false);
  });

  it('countdown resumes when business hours start again', () => {
    // Monday 09:00 UTC — 1h into the workday, so 1h Fri + 1h Mon = 2h
    // business elapsed, 2h remaining.
    vi.setSystemTime(new Date(Date.UTC(2025, 5, 9, 9, 0, 0)));
    const monMorning = getSlaStatus(ticket, [policy], [utcSchedule])!;
    expect(monMorning.timeRemainingMs).toBe(2 * 60 * 60 * 1000);
    expect(monMorning.isOverdue).toBe(false);
  });

  it('overdue counter pauses outside business hours', () => {
    // Monday 11:30 UTC — 30 min past the 11:00 UTC deadline.
    vi.setSystemTime(new Date(Date.UTC(2025, 5, 9, 11, 30, 0)));
    const justOverdue = getSlaStatus(ticket, [policy], [utcSchedule])!;
    expect(justOverdue.isOverdue).toBe(true);
    expect(justOverdue.timeRemainingMs).toBe(-30 * 60 * 1000);

    // Monday 17:00 UTC — close. 6h business overdue (11:00–17:00).
    vi.setSystemTime(new Date(Date.UTC(2025, 5, 9, 17, 0, 0)));
    const monClose = getSlaStatus(ticket, [policy], [utcSchedule])!;
    expect(monClose.timeRemainingMs).toBe(-6 * 60 * 60 * 1000);

    // Tuesday 08:00 UTC — overnight gap from Mon 17:00 → Tue 08:00 is
    // non-business, so still 6h overdue, NOT ~21h calendar overdue.
    vi.setSystemTime(new Date(Date.UTC(2025, 5, 10, 8, 0, 0)));
    const tueOpen = getSlaStatus(ticket, [policy], [utcSchedule])!;
    expect(tueOpen.timeRemainingMs).toBe(-6 * 60 * 60 * 1000);
  });

  it('falls back to wall-clock when no schedule provided', () => {
    // No schedule passed in — original calendar-hours behavior.
    vi.setSystemTime(new Date(Date.UTC(2025, 5, 7, 12, 0, 0))); // Sat noon
    const calendar = getSlaStatus(ticket, [policy])!;
    // Anchor Fri 16:00 + 4h = Fri 20:00. Sat noon is 16h after that.
    expect(calendar.timeRemainingMs).toBe(-16 * 60 * 60 * 1000);
    expect(calendar.isOverdue).toBe(true);
  });
});

// ── Schedule lookup is case-insensitive ──────────────────────

describe('findScheduleForTicket case-insensitivity', () => {
  const baseSchedule: DepartmentSchedule = {
    id: 'sched-cs',
    department_name: 'IT Support',
    timezone: 'UTC',
    business_hours: [
      { day: 'monday', enabled: true, startTime: '08:00', endTime: '17:00' },
      { day: 'tuesday', enabled: true, startTime: '08:00', endTime: '17:00' },
      { day: 'wednesday', enabled: true, startTime: '08:00', endTime: '17:00' },
      { day: 'thursday', enabled: true, startTime: '08:00', endTime: '17:00' },
      { day: 'friday', enabled: true, startTime: '08:00', endTime: '17:00' },
      { day: 'saturday', enabled: false, startTime: '08:00', endTime: '17:00' },
      { day: 'sunday', enabled: false, startTime: '08:00', endTime: '17:00' },
    ],
    holidays: [],
    enabled: true,
  };

  const policy: SlaPolicy = {
    id: 'p',
    name: 'Std',
    enabled: true,
    conditions: { ticketTypes: 'any', categories: 'any', priorities: 'any' },
    metrics: { firstReplyHours: 4, nextReplyHours: 8 },
    sort_order: 1,
  };

  function ticketAt(now: string, ticket_type: string): Ticket {
    return {
      id: 'T-cs',
      title: 't',
      description: 'd',
      status: 'open',
      priority: 'medium',
      category: 'General',
      ticket_type,
      created_by: 'user-1',
      created_at: now,
      updated_at: now,
      messages: [],
    };
  }

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('matches schedule when ticket_type case differs from department_name', () => {
    // Anchor Fri 16:00 UTC, snap to Sat noon — should pause through weekend
    // exactly as the case-matching test above does, proving the schedule
    // was found despite the case drift.
    vi.setSystemTime(new Date(Date.UTC(2025, 5, 7, 12, 0, 0)));

    const lower = getSlaStatus(
      ticketAt('2025-06-06T16:00:00.000Z', 'it support'),
      [policy],
      [baseSchedule],
    )!;
    const mixed = getSlaStatus(
      ticketAt('2025-06-06T16:00:00.000Z', 'It SuPpOrT'),
      [policy],
      [baseSchedule],
    )!;
    const exact = getSlaStatus(
      ticketAt('2025-06-06T16:00:00.000Z', 'IT Support'),
      [policy],
      [baseSchedule],
    )!;

    // All three should report the same business-hours-aware remaining time.
    expect(lower.timeRemainingMs).toBe(exact.timeRemainingMs);
    expect(mixed.timeRemainingMs).toBe(exact.timeRemainingMs);
    expect(exact.timeRemainingMs).toBe(3 * 60 * 60 * 1000);
  });
});
