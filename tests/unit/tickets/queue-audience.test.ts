// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  eligibleQueueRecipients,
  teamForDepartment,
} from '@/lib/tickets/queue-audience'
import * as templates from '@/lib/email/templates'

// The nine real queues, as they exist in the live teams table.
const TEAMS = [
  { id: 'team-closing', name: 'Closing Support' },
  { id: 'team-it', name: 'IT Support' },
  { id: 'team-lending', name: 'Lending Support' },
  { id: 'team-marketing', name: 'Marketing Support' },
  { id: 'team-payoff', name: 'Payoff Request' },
  { id: 'team-product-desk', name: 'Product Desk (Non-Agency Products)' },
  { id: 'team-secondary', name: 'Secondary Support' },
  { id: 'b0292305-6100-4c26-96c3-b79ea748d19b', name: 'Doc Magic Support' },
  { id: '93581d07-a3bb-488a-b1a5-e5f673bfc642', name: 'System Support' },
]

describe('teamForDepartment', () => {
  // Every department in use must resolve, or a move silently goes nowhere.
  it.each([
    ['Secondary Support', 'team-secondary'],
    ['Lending Support', 'team-lending'],
    ['IT Support', 'team-it'],
    ['Closing Support', 'team-closing'],
    ['Marketing Support', 'team-marketing'],
    ['System Support', '93581d07-a3bb-488a-b1a5-e5f673bfc642'],
    ['Doc Magic Support', 'b0292305-6100-4c26-96c3-b79ea748d19b'],
    ['Payoff Request', 'team-payoff'],
    ['Product Desk (Non-Agency Products)', 'team-product-desk'],
  ])('routes %s to its queue', (department, expectedId) => {
    expect(teamForDepartment(department, TEAMS)?.id).toBe(expectedId)
  })

  it('survives stray spacing and capitalisation on either side', () => {
    expect(teamForDepartment('  lending support ', TEAMS)?.id).toBe('team-lending')
    expect(
      teamForDepartment('Lending Support', [
        { id: 'team-lending', name: ' LENDING SUPPORT ' },
      ])?.id,
    ).toBe('team-lending')
  })

  it('returns null rather than guessing when no queue matches', () => {
    expect(teamForDepartment('Underwriting', TEAMS)).toBeNull()
    expect(teamForDepartment(null, TEAMS)).toBeNull()
    expect(teamForDepartment('', TEAMS)).toBeNull()
    expect(teamForDepartment('Lending Support', [])).toBeNull()
    expect(teamForDepartment('Lending Support', null)).toBeNull()
  })

  it('does not match on a partial name', () => {
    expect(teamForDepartment('Support', TEAMS)).toBeNull()
    expect(teamForDepartment('Lending', TEAMS)).toBeNull()
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

  it('takes the agents and admins who are actually available', () => {
    expect(eligibleQueueRecipients(members)).toEqual(['agent-1', 'admin-1'])
  })

  it('leaves out whoever performed the move', () => {
    expect(eligibleQueueRecipients(members, { exclude: ['agent-1'] })).toEqual([
      'admin-1',
    ])
  })

  it('ignores empty exclusions', () => {
    expect(
      eligibleQueueRecipients(members, { exclude: [null, undefined, ''] }),
    ).toEqual(['agent-1', 'admin-1'])
  })
})

describe('the move email', () => {
  const base = {
    ticketId: 'T-4687',
    title: 'Milligan - VA IRRRL',
    fromLabel: 'IT Support',
    toLabel: 'Lending Support',
    movedByName: 'Sam Admin',
  }

  it('says where it came from, where it went, and who moved it', () => {
    const { subject, html } = templates.ticketMovedToQueue({
      ...base,
      unassigned: true,
    })
    expect(subject).toBe('[T-4687] Moved to Lending Support: Milligan - VA IRRRL')
    expect(html).toContain('Sam Admin')
    expect(html).toContain('IT Support')
    expect(html).toContain('Lending Support')
  })

  it('spells out that nobody owns it yet', () => {
    const { html } = templates.ticketMovedToQueue({ ...base, unassigned: true })
    expect(html).toContain('Nobody is assigned to it')
  })

  it('stays quiet about ownership when someone still owns it', () => {
    const { html } = templates.ticketMovedToQueue({ ...base, unassigned: false })
    expect(html).not.toContain('Nobody is assigned to it')
  })
})
