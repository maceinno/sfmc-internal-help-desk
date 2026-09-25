import { describe, it, expect } from 'vitest'
import {
  latestUpdatedAt,
  mergeChangedTickets,
  patchTicketInList,
} from '@/lib/tickets/list-cache'
import type { Ticket } from '@/types/ticket'

// Minimal list-shaped tickets; only the fields these helpers read matter.
function t(
  id: string,
  created_at: string,
  updated_at: string,
  extra: Partial<Ticket> = {},
): Ticket {
  return {
    id,
    created_at,
    updated_at,
    status: 'open',
    assigned_to: null,
    messages: [{ id: `${id}-m1` }],
    cc: ['u-cc'],
    ...extra,
  } as unknown as Ticket
}

describe('patchTicketInList', () => {
  it('applies a solve to the cached ticket so views filtering on status drop it at once', () => {
    const list = [t('T-2', '2026-09-25T10:00:00Z', '2026-09-25T10:00:00Z'), t('T-1', '2026-09-24T10:00:00Z', '2026-09-24T10:00:00Z')]
    const next = patchTicketInList(list, 'T-1', {
      id: 'T-1',
      status: 'solved',
      assigned_to: 'agent-1',
      updated_at: '2026-09-25T12:00:00Z',
    } as Partial<Ticket>)

    const solved = next.find((x) => x.id === 'T-1')!
    expect(solved.status).toBe('solved')
    expect(solved.assigned_to).toBe('agent-1')
    // What an "Unsolved" view does with it:
    expect(next.filter((x) => x.status !== 'solved').map((x) => x.id)).toEqual(['T-2'])
  })

  it('keeps the embedded messages and CC list that an update response does not carry', () => {
    const list = [t('T-1', '2026-09-24T10:00:00Z', '2026-09-24T10:00:00Z')]
    const next = patchTicketInList(list, 'T-1', { status: 'solved' } as Partial<Ticket>)
    expect(next[0].messages).toEqual([{ id: 'T-1-m1' }])
    expect(next[0].cc).toEqual(['u-cc'])
  })

  it('does not mutate the cached array or the cached ticket', () => {
    const list = [t('T-1', '2026-09-24T10:00:00Z', '2026-09-24T10:00:00Z')]
    const before = list[0]
    const next = patchTicketInList(list, 'T-1', { status: 'solved' } as Partial<Ticket>)
    expect(next).not.toBe(list)
    expect(list[0]).toBe(before)
    expect(before.status).toBe('open')
  })

  it('returns the same array when the ticket is not in the list', () => {
    const list = [t('T-1', '2026-09-24T10:00:00Z', '2026-09-24T10:00:00Z')]
    expect(patchTicketInList(list, 'T-9', { status: 'solved' } as Partial<Ticket>)).toBe(list)
  })
})

describe('mergeChangedTickets', () => {
  const list = [
    t('T-3', '2026-09-25T10:00:00Z', '2026-09-25T10:00:00Z'),
    t('T-2', '2026-09-24T10:00:00Z', '2026-09-24T10:00:00Z'),
    t('T-1', '2026-09-23T10:00:00Z', '2026-09-23T10:00:00Z'),
  ]

  it('replaces a changed ticket in place without reordering', () => {
    const changed = [t('T-1', '2026-09-23T10:00:00Z', '2026-09-25T11:00:00Z', { status: 'solved' } as Partial<Ticket>)]
    const next = mergeChangedTickets(list, changed)
    expect(next.map((x) => x.id)).toEqual(['T-3', 'T-2', 'T-1'])
    expect(next[2].status).toBe('solved')
  })

  it('adds a brand-new ticket at the top (newest created first)', () => {
    const changed = [t('T-4', '2026-09-25T12:00:00Z', '2026-09-25T12:00:00Z')]
    expect(mergeChangedTickets(list, changed).map((x) => x.id)).toEqual(['T-4', 'T-3', 'T-2', 'T-1'])
  })

  it('handles a mix of new and changed tickets', () => {
    const changed = [
      t('T-4', '2026-09-25T12:00:00Z', '2026-09-25T12:00:00Z'),
      t('T-2', '2026-09-24T10:00:00Z', '2026-09-25T12:00:00Z', { status: 'pending' } as Partial<Ticket>),
    ]
    const next = mergeChangedTickets(list, changed)
    expect(next.map((x) => x.id)).toEqual(['T-4', 'T-3', 'T-2', 'T-1'])
    expect(next.find((x) => x.id === 'T-2')!.status).toBe('pending')
  })

  it('returns the same array when nothing changed', () => {
    expect(mergeChangedTickets(list, [])).toBe(list)
  })
})

describe('latestUpdatedAt', () => {
  it('finds the newest change regardless of list order', () => {
    const list = [
      t('T-3', '2026-09-25T10:00:00Z', '2026-09-25T10:00:00Z'),
      t('T-1', '2026-09-23T10:00:00Z', '2026-09-25T15:30:00.123456+00:00'),
    ]
    expect(latestUpdatedAt(list)).toBe('2026-09-25T15:30:00.123456+00:00')
  })

  it('is null for an empty list, so the caller falls back to a full load', () => {
    expect(latestUpdatedAt([])).toBeNull()
  })
})
