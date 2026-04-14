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

  it('correctly identifies overdue tickets (legacy fallback)', () => {
    const createdAt = '2025-06-01T09:00:00Z';
    const ticket = makeTicket({ priority: 'urgent', createdAt });

    // Urgent = 2 hours. Set clock 3 hours after creation.
    const createdMs = new Date(createdAt).getTime();
    vi.setSystemTime(new Date(createdMs + 3 * 60 * 60 * 1000));

    const status = getSlaStatus(ticket);
    expect(status).not.toBeNull();
    expect(status!.isOverdue).toBe(true);
    expect(status!.timeRemainingMs).toBeLessThan(0);
  });

  it('correctly identifies at-risk tickets (legacy fallback)', () => {
    const createdAt = '2025-06-01T09:00:00Z';
    const ticket = makeTicket({ priority: 'medium', createdAt });

    // Medium = 8 hours. Set clock at 7 hours (87.5% used, > 75% threshold).
    const createdMs = new Date(createdAt).getTime();
    vi.setSystemTime(new Date(createdMs + 7 * 60 * 60 * 1000));

    const status = getSlaStatus(ticket);
    expect(status).not.toBeNull();
    expect(status!.isOverdue).toBe(false);
    expect(status!.isAtRisk).toBe(true);
  });

  it('uses policy-based calculation when policies are provided', () => {
    const createdAt = '2025-06-01T09:00:00Z';
    const ticket = makeTicket({
      priority: 'high',
      createdAt,
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
    const createdMs = new Date(createdAt).getTime();
    vi.setSystemTime(new Date(createdMs + 3 * 60 * 60 * 1000));

    const status = getSlaStatus(ticket, [policy]);
    expect(status).not.toBeNull();
    expect(status!.isOverdue).toBe(true);
    expect(status!.metric).toBe('firstReply');
    expect(status!.policyName).toBe('Standard Policy');
  });

  it('reports non-overdue status when within SLA window', () => {
    const createdAt = '2025-06-01T09:00:00Z';
    const ticket = makeTicket({ priority: 'low', createdAt });

    // Low = 24 hours. Set clock 1 hour after creation.
    const createdMs = new Date(createdAt).getTime();
    vi.setSystemTime(new Date(createdMs + 1 * 60 * 60 * 1000));

    const status = getSlaStatus(ticket);
    expect(status).not.toBeNull();
    expect(status!.isOverdue).toBe(false);
    expect(status!.isAtRisk).toBe(false);
    expect(status!.timeRemainingMs).toBeGreaterThan(0);
  });

  it('uses business hours when schedule is provided', () => {
    // Wednesday 2025-06-04 at 15:00 UTC
    const createdAt = '2025-06-04T15:00:00.000Z';
    const ticket = makeTicket({
      priority: 'high',
      createdAt,
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
    vi.setSystemTime(new Date(createdAt));

    const status = getSlaStatus(ticket, [policy], [schedule]);
    expect(status).not.toBeNull();
    expect(status!.policyName).toBe('Standard Policy');
    // The deadline should be calculated via business hours
    expect(status!.slaDeadline).toBeInstanceOf(Date);
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

    const result = getOverdueTickets([overdueTicket, okTicket]);
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

    const result = getAtRiskTickets([atRiskTicket, safeTicket]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('T-risk');
  });
});

// ── Business Hours ───────────────────────────────────────────

describe('Business hours calculations', () => {
  it('calculateBusinessHoursDeadline skips non-business hours', () => {
    const schedule = makeSchedule();

    // Friday 2025-06-06 at 16:00 (1 hour before close)
    // Requesting 4 business hours: 1h Friday + 3h Monday = Monday 11:00
    const friday4pm = new Date(2025, 5, 6, 16, 0, 0).getTime();
    const deadline = calculateBusinessHoursDeadline(friday4pm, 4, schedule);
    const deadlineDate = new Date(deadline);

    // Should land on Monday (June 9) at 11:00
    expect(deadlineDate.getDay()).toBe(1); // Monday
    expect(deadlineDate.getHours()).toBe(11);
    expect(deadlineDate.getMinutes()).toBe(0);
  });

  it('calculateBusinessHoursElapsed counts only business hours', () => {
    const schedule = makeSchedule();

    // Friday 2025-06-06 at 16:00 to Monday 2025-06-09 at 10:00
    // Business time: 1h (Fri 16-17) + 2h (Mon 08-10) = 3h
    const fridayStart = new Date(2025, 5, 6, 16, 0, 0).getTime();
    const mondayEnd = new Date(2025, 5, 9, 10, 0, 0).getTime();
    const elapsed = calculateBusinessHoursElapsed(fridayStart, mondayEnd, schedule);

    const expectedMs = 3 * 60 * 60 * 1000;
    expect(elapsed).toBe(expectedMs);
  });

  it('calculateBusinessHoursDeadline skips holidays', () => {
    const schedule = makeSchedule({
      holidays: [
        { id: 'h-1', name: 'Test Holiday', date: '2025-06-05' },
      ],
    });

    // Wednesday 2025-06-04 at 16:00 (1h left in day)
    // Thursday 2025-06-05 is a holiday -> skip
    // Friday 2025-06-06 starts at 08:00, need 3 more hours -> 11:00
    const wed4pm = new Date(2025, 5, 4, 16, 0, 0).getTime();
    const deadline = calculateBusinessHoursDeadline(wed4pm, 4, schedule);
    const deadlineDate = new Date(deadline);

    expect(deadlineDate.getDate()).toBe(6); // Friday
    expect(deadlineDate.getHours()).toBe(11);
  });
});

// ── isHoliday ────────────────────────────────────────────────

describe('isHoliday', () => {
  it('detects holidays correctly', () => {
    const holidays = [
      { date: '2025-07-04' },
      { date: '2025-12-25' },
    ];

    expect(isHoliday(new Date(2025, 6, 4), holidays)).toBe(true);
    expect(isHoliday(new Date(2025, 11, 25), holidays)).toBe(true);
  });

  it('returns false for non-holidays', () => {
    const holidays = [{ date: '2025-07-04' }];
    expect(isHoliday(new Date(2025, 6, 3), holidays)).toBe(false);
    expect(isHoliday(new Date(2025, 6, 5), holidays)).toBe(false);
  });

  it('returns false for an empty holiday list', () => {
    expect(isHoliday(new Date(2025, 0, 1), [])).toBe(false);
  });
});
