import { describe, it, expect } from 'vitest'
import {
  AGENT_WAITING_STATUSES,
  replyStatusForRole,
  shouldAutoReopen,
} from '@/lib/tickets/reply-status'
import type { TicketStatus } from '@/types/ticket'

const ALL: TicketStatus[] = ['new', 'open', 'pending', 'on_hold', 'solved']

describe('replyStatusForRole — what a reply carries', () => {
  it('never lets an employee reply carry a status', () => {
    for (const currentStatus of ALL) {
      const decision = replyStatusForRole({
        isAgentOrAdmin: false,
        currentStatus,
        // Even if something upstream tried to hand one over.
        agentPick: 'open',
        keepSolved: false,
      })
      expect(decision.nextStatus).toBeNull()
    }
  })

  it('keeps the agent pick for agents and admins', () => {
    for (const pick of ALL) {
      expect(
        replyStatusForRole({
          isAgentOrAdmin: true,
          currentStatus: 'new',
          agentPick: pick,
          keepSolved: false,
        }).nextStatus,
      ).toBe(pick)
    }
  })

  it('honours "keep solved" only on a solved ticket', () => {
    expect(
      replyStatusForRole({
        isAgentOrAdmin: false,
        currentStatus: 'solved',
        agentPick: null,
        keepSolved: true,
      }).keepStatus,
    ).toBe(true)

    for (const currentStatus of ['new', 'open', 'pending', 'on_hold'] as const) {
      expect(
        replyStatusForRole({
          isAgentOrAdmin: false,
          currentStatus,
          agentPick: null,
          keepSolved: true,
        }).keepStatus,
      ).toBe(false)
    }
  })

  it('never sets keepStatus for an agent', () => {
    expect(
      replyStatusForRole({
        isAgentOrAdmin: true,
        currentStatus: 'solved',
        agentPick: null,
        keepSolved: true,
      }).keepStatus,
    ).toBe(false)
  })
})

describe('shouldAutoReopen — what the API does with it', () => {
  const employeePublicReply = {
    isInternalNote: false,
    isAgentOrAdmin: false,
    keepStatus: false,
  }

  it('leaves a NEW ticket New when its own author replies', () => {
    // The whole point: a follow-up from the requester must not push their
    // ticket out of the unpicked queue.
    expect(
      shouldAutoReopen({ ...employeePublicReply, currentStatus: 'new' }),
    ).toBe(false)
    expect(AGENT_WAITING_STATUSES).not.toContain('new')
  })

  it('reopens solved, pending and on-hold tickets', () => {
    for (const currentStatus of ['solved', 'pending', 'on_hold'] as const) {
      expect(
        shouldAutoReopen({ ...employeePublicReply, currentStatus }),
      ).toBe(true)
    }
  })

  it('does nothing to a ticket that is already open', () => {
    expect(
      shouldAutoReopen({ ...employeePublicReply, currentStatus: 'open' }),
    ).toBe(false)
  })

  it('stands down when the requester chose to keep it solved', () => {
    expect(
      shouldAutoReopen({
        ...employeePublicReply,
        currentStatus: 'solved',
        keepStatus: true,
      }),
    ).toBe(false)
  })

  it('never fires for an internal note', () => {
    for (const currentStatus of ALL) {
      expect(
        shouldAutoReopen({
          ...employeePublicReply,
          currentStatus,
          isInternalNote: true,
        }),
      ).toBe(false)
    }
  })

  it('never fires for an agent or admin — they carry their own status', () => {
    for (const currentStatus of ALL) {
      expect(
        shouldAutoReopen({
          ...employeePublicReply,
          currentStatus,
          isAgentOrAdmin: true,
        }),
      ).toBe(false)
    }
  })
})
