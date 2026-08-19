import { describe, it, expect } from 'vitest'
import {
  buildUserIndex,
  escapeLikeTerm,
  normalizeReference,
  ticketMatchesSearch,
} from '@/lib/tickets/search'
import type { Ticket, User } from '@/types'

const users = [
  { id: 'u1', name: 'Clancy Short', email: 'clancy.short@sfmchl.test', role: 'agent' },
  { id: 'u2', name: 'Rachel Smotherman', email: 'rachel.s@sfmchl.test', role: 'agent' },
] as unknown as User[]

const ctx = { usersById: buildUserIndex(users) }

/**
 * Fixtures mirror the shapes actually present in the live data — including
 * the leading tab and trailing space that real loan numbers were pasted in
 * with, and the case where the number only exists inside a borrower name.
 */
function ticket(over: Partial<Ticket> & { id: string }): Ticket {
  return {
    title: 'Untitled',
    description: '',
    status: 'solved',
    priority: 'medium',
    category: 'Other',
    created_by: 'u1',
    assigned_to: 'u2',
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    custom_fields: [],
    ...over,
  } as unknown as Ticket
}

const tabbedLoan = ticket({
  id: 'T-1214',
  title: 'PTS - Well water Inspection - Howe',
  custom_fields: [
    { field_id: 'custom-loan-number', value: '\t45001880634' },
    { field_id: 'custom-borrower-name', value: 'Ashley Howe' },
  ],
})

const spacedLoan = ticket({
  id: 'T-1212',
  title: 'Kraemer 62001880407 - Investor Condition',
  custom_fields: [{ field_id: 'custom-loan-number', value: '62001880407 ' }],
})

const loanOnlyInBorrower = ticket({
  id: 'T-1089',
  title: 'PE Request',
  custom_fields: [
    { field_id: 'custom-borrower-name', value: 'John Rhew-45001880556' },
  ],
})

const descriptionOnly = ticket({
  id: 'T-3642',
  title: 'Cochran - Investor Condition',
  description: "<p>B1 is <strong>self-employed</strong> but we don't have the 4506-c.</p>",
})

const unrelated = ticket({ id: 'T-9999', title: 'Order business cards' })

const all = [tabbedLoan, spacedLoan, loanOnlyInBorrower, descriptionOnly, unrelated]

function search(term: string) {
  return all.filter((t) => ticketMatchesSearch(t, term, ctx)).map((t) => t.id)
}

describe('ticket search — loan and lead numbers', () => {
  it('finds a loan number stored with a leading tab', () => {
    expect(search('45001880634')).toEqual(['T-1214'])
  })

  it('finds a loan number stored with a trailing space', () => {
    expect(search('62001880407')).toEqual(['T-1212'])
  })

  it('finds a number that only exists inside the borrower name', () => {
    expect(search('45001880556')).toEqual(['T-1089'])
  })

  it('finds a loan number the user typed with punctuation', () => {
    expect(search('4500-1880-634')).toEqual(['T-1214'])
  })

  it('does not match unrelated tickets', () => {
    expect(search('45001880634')).not.toContain('T-9999')
  })
})

describe('ticket search — text and people', () => {
  it('finds words that are only in the description, not the subject', () => {
    expect(search('self-employed')).toEqual(['T-3642'])
  })

  it('ignores the markup around description text', () => {
    // "self-employed" is wrapped in <strong> in the stored description.
    expect(search('strong')).not.toContain('T-3642')
  })

  it('finds tickets by the name of the person they are assigned to', () => {
    expect(search('Rachel')).toHaveLength(all.length)
  })

  it('finds tickets by requester email', () => {
    expect(search('clancy.short@')).toHaveLength(all.length)
  })

  it('finds a borrower by name', () => {
    expect(search('Ashley Howe')).toEqual(['T-1214'])
  })
})

describe('ticket search — ticket numbers', () => {
  it('matches the full ticket number', () => {
    expect(search('T-1214')).toEqual(['T-1214'])
  })

  it('matches a bare ticket number without the prefix', () => {
    expect(search('1212')).toEqual(['T-1212'])
  })

  it('is case-insensitive', () => {
    expect(search('t-1214')).toEqual(['T-1214'])
  })
})

describe('ticket search — edge cases', () => {
  it('an empty or whitespace-only term matches everything', () => {
    expect(search('')).toHaveLength(all.length)
    expect(search('   ')).toHaveLength(all.length)
  })

  it('tolerates a ticket with no custom fields at all', () => {
    const bare = ticket({ id: 'T-8888', custom_fields: undefined })
    expect(ticketMatchesSearch(bare, '45001880634', ctx)).toBe(false)
    expect(ticketMatchesSearch(bare, 'T-8888', ctx)).toBe(true)
  })

  it('tolerates a null custom field value', () => {
    const nulled = ticket({
      id: 'T-7777',
      custom_fields: [{ field_id: 'custom-loan-number', value: null }],
    })
    expect(ticketMatchesSearch(nulled, '4500', ctx)).toBe(false)
  })

  it('escapes SQL wildcards before a reply search hits the database', () => {
    // A user typing "%" must not match every reply in the system.
    expect(escapeLikeTerm('100%')).toBe('100\\%')
    expect(escapeLikeTerm('a_b')).toBe('a\\_b')
    expect(escapeLikeTerm('back\\slash')).toBe('back\\\\slash')
    // Ordinary terms pass through untouched.
    expect(escapeLikeTerm('45001880634')).toBe('45001880634')
    expect(escapeLikeTerm('wire not received')).toBe('wire not received')
  })

  it('normalizes references consistently', () => {
    expect(normalizeReference('\t45001880634')).toBe('45001880634')
    expect(normalizeReference('62001880407 ')).toBe('62001880407')
    expect(normalizeReference('John Rhew-45001880556')).toBe('johnrhew45001880556')
  })
})
