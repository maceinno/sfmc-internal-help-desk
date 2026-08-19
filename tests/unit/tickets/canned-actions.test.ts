// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  cannedTicketUpdates,
  statusFromCannedResponse,
} from '@/lib/tickets/canned-actions'

describe('cannedTicketUpdates', () => {
  it('applies status, priority and team when the caller has no status decision', () => {
    expect(
      cannedTicketUpdates(
        { setStatus: 'solved', setPriority: 'high', setTeam: 'team-lending' },
        { statusDecidedByCaller: false },
      ),
    ).toEqual({
      status: 'solved',
      priority: 'high',
      assigned_team: 'team-lending',
    })
  })

  // The regression: the composer applied its own status right after the
  // reply landed, overwriting the template's. Exactly one side owns status.
  it('leaves status to the caller when the caller decided, keeping priority and team', () => {
    expect(
      cannedTicketUpdates(
        { setStatus: 'solved', setPriority: 'high', setTeam: 'team-lending' },
        { statusDecidedByCaller: true },
      ),
    ).toEqual({
      priority: 'high',
      assigned_team: 'team-lending',
    })
  })

  it('returns nothing for a template with no actions', () => {
    expect(cannedTicketUpdates(null, { statusDecidedByCaller: false })).toEqual({})
    expect(
      cannedTicketUpdates(undefined, { statusDecidedByCaller: true }),
    ).toEqual({})
    expect(cannedTicketUpdates({}, { statusDecidedByCaller: false })).toEqual({})
  })

  it('ignores an internal-note-only action for ticket columns', () => {
    expect(
      cannedTicketUpdates(
        { addInternalNote: 'Escalated to lending' },
        { statusDecidedByCaller: false },
      ),
    ).toEqual({})
  })
})

describe('statusFromCannedResponse', () => {
  it('returns the status the composer should pre-select', () => {
    expect(statusFromCannedResponse({ setStatus: 'solved' })).toBe('solved')
    expect(statusFromCannedResponse({ setStatus: 'pending' })).toBe('pending')
  })

  it('returns null when the template has no status action, so the agent keeps their pick', () => {
    expect(statusFromCannedResponse({ setPriority: 'high' })).toBeNull()
    expect(statusFromCannedResponse({})).toBeNull()
    expect(statusFromCannedResponse(null)).toBeNull()
    expect(statusFromCannedResponse(undefined)).toBeNull()
  })
})

// End-to-end of the decision, in the order the app performs it: insert the
// template, send, then the page applies the composer's status. Before the
// fix the last write was the composer's *default* (Open -> Pending), so a
// "-> Solved" template ended up Pending.
describe('template status survives the send', () => {
  function simulate(opts: {
    ticketStatus: string
    composerDefault: string
    templateStatus?: 'solved' | 'pending' | 'open'
    adoptTemplateStatus: boolean
    serverKnowsCallerDecided: boolean
  }) {
    let status = opts.ticketStatus

    // 1. Agent inserts the template.
    const pendingStatus =
      opts.adoptTemplateStatus && opts.templateStatus
        ? opts.templateStatus
        : opts.composerDefault

    // 2. Server-side template actions.
    const updates = cannedTicketUpdates(
      opts.templateStatus ? { setStatus: opts.templateStatus } : null,
      { statusDecidedByCaller: opts.serverKnowsCallerDecided },
    )
    if (typeof updates.status === 'string') status = updates.status

    // 3. Page applies the composer's status after the reply lands.
    if (pendingStatus && pendingStatus !== opts.ticketStatus) {
      status = pendingStatus
    }

    return status
  }

  it('reproduces the old behaviour: the composer default clobbered the template', () => {
    expect(
      simulate({
        ticketStatus: 'open',
        composerDefault: 'pending',
        templateStatus: 'solved',
        adoptTemplateStatus: false,
        serverKnowsCallerDecided: false,
      }),
    ).toBe('pending')
  })

  it('now ends on the template status from an open ticket', () => {
    expect(
      simulate({
        ticketStatus: 'open',
        composerDefault: 'pending',
        templateStatus: 'solved',
        adoptTemplateStatus: true,
        serverKnowsCallerDecided: true,
      }),
    ).toBe('solved')
  })

  it('now ends on the template status from a new ticket', () => {
    expect(
      simulate({
        ticketStatus: 'new',
        composerDefault: 'open',
        templateStatus: 'pending',
        adoptTemplateStatus: true,
        serverKnowsCallerDecided: true,
      }),
    ).toBe('pending')
  })

  it('leaves the composer default alone for a template with no status action', () => {
    expect(
      simulate({
        ticketStatus: 'open',
        composerDefault: 'pending',
        adoptTemplateStatus: true,
        serverKnowsCallerDecided: true,
      }),
    ).toBe('pending')
  })
})
