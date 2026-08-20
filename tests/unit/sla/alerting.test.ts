// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  planSlaAlert,
  eligibleQueueRecipients,
  STALE_BREACH_CUTOFF_HOURS,
} from '@/lib/sla/alerting'

const NOW = new Date('2026-08-19T20:00:00Z').getTime()
const hoursFromNow = (h: number) => new Date(NOW + h * 60 * 60 * 1000)

describe('planSlaAlert', () => {
  it('warns when the deadline is approaching', () => {
    expect(
      planSlaAlert({
        isAtRisk: true,
        isOverdue: false,
        slaDeadline: hoursFromNow(1),
        now: NOW,
      }),
    ).toEqual({ alert: true, stage: 'warning' })
  })

  it('says nothing while the ticket is comfortably inside its SLA', () => {
    expect(
      planSlaAlert({
        isAtRisk: false,
        isOverdue: false,
        slaDeadline: hoursFromNow(6),
        now: NOW,
      }),
    ).toEqual({ alert: false, reason: 'within_sla' })
  })

  it('reports a fresh breach', () => {
    expect(
      planSlaAlert({
        isAtRisk: false,
        isOverdue: true,
        slaDeadline: hoursFromNow(-2),
        now: NOW,
      }),
    ).toEqual({ alert: true, stage: 'breach' })
  })

  // The backlog guard. The job had never run, so switching it on would
  // otherwise have emailed about tickets overdue by days — one by ten days.
  it('stays quiet about a breach that is already stale', () => {
    expect(
      planSlaAlert({
        isAtRisk: false,
        isOverdue: true,
        slaDeadline: hoursFromNow(-(STALE_BREACH_CUTOFF_HOURS + 1)),
        now: NOW,
      }),
    ).toEqual({ alert: false, reason: 'stale_breach' })

    // T-2641 on the live data: overdue by more than ten days.
    expect(
      planSlaAlert({
        isAtRisk: false,
        isOverdue: true,
        slaDeadline: hoursFromNow(-24 * 10),
        now: NOW,
      }),
    ).toEqual({ alert: false, reason: 'stale_breach' })
  })

  it('treats the cutoff as inclusive — right on the line still alerts', () => {
    expect(
      planSlaAlert({
        isAtRisk: false,
        isOverdue: true,
        slaDeadline: hoursFromNow(-STALE_BREACH_CUTOFF_HOURS),
        now: NOW,
      }),
    ).toEqual({ alert: true, stage: 'breach' })
  })

  it('can be told to sweep up every old breach', () => {
    expect(
      planSlaAlert({
        isAtRisk: false,
        isOverdue: true,
        slaDeadline: hoursFromNow(-24 * 30),
        now: NOW,
        staleBreachCutoffHours: Infinity,
      }),
    ).toEqual({ alert: true, stage: 'breach' })
  })

  it('breach wins when a ticket is somehow flagged both ways', () => {
    expect(
      planSlaAlert({
        isAtRisk: true,
        isOverdue: true,
        slaDeadline: hoursFromNow(-1),
        now: NOW,
      }),
    ).toEqual({ alert: true, stage: 'breach' })
  })
})

describe('eligibleQueueRecipients', () => {
  const members = [
    { id: 'agent-1', email: 'a1@sfmc.com', role: 'agent' },
    { id: 'admin-1', email: 'ad1@sfmc.com', role: 'admin' },
    { id: 'employee-1', email: 'e1@sfmc.com', role: 'employee' },
    { id: 'agent-ooo', email: 'ooo@sfmc.com', role: 'agent', is_out_of_office: true },
    { id: 'agent-off', email: 'off@sfmc.com', role: 'agent', is_active: false },
    { id: 'agent-noemail', email: null, role: 'agent' },
  ]

  it('includes agents and admins on the queue', () => {
    expect(eligibleQueueRecipients(members)).toEqual(['agent-1', 'admin-1'])
  })

  it('leaves out employees, out-of-office, deactivated and address-less members', () => {
    const got = eligibleQueueRecipients(members)
    expect(got).not.toContain('employee-1')
    expect(got).not.toContain('agent-ooo')
    expect(got).not.toContain('agent-off')
    expect(got).not.toContain('agent-noemail')
  })

  it('handles an empty or missing queue without throwing', () => {
    expect(eligibleQueueRecipients([])).toEqual([])
    expect(eligibleQueueRecipients(null)).toEqual([])
    expect(eligibleQueueRecipients(undefined)).toEqual([])
  })

  it('treats a member with is_active unset as active (the column defaults on)', () => {
    expect(
      eligibleQueueRecipients([
        { id: 'agent-2', email: 'a2@sfmc.com', role: 'agent', is_active: null },
      ]),
    ).toEqual(['agent-2'])
  })
})
