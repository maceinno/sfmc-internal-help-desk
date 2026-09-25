// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Ticket, User } from '@/types/ticket'

// Isolate the list's own search logic: stub the config hooks, the server-side
// reply search, and the table (which renders just the ticket ids it is given).
vi.mock('@/hooks/use-admin-config', () => ({
  useSlaPolicies: () => ({ data: [] }),
  useDepartmentSchedules: () => ({ data: [] }),
  useDepartmentCategories: () => ({ data: [] }),
}))
vi.mock('@/hooks/use-reply-search', () => ({
  useReplySearch: () => ({ matches: [], isLoading: false }),
}))
vi.mock('@/components/tickets/ticket-table', () => ({
  TicketTable: ({ tickets }: { tickets: Ticket[] }) => (
    <ul>
      {tickets.map((t) => (
        <li key={t.id}>{t.id}</li>
      ))}
    </ul>
  ),
}))

const { TicketList } = await import('@/components/tickets/ticket-list')

function ticket(id: string, title: string, created_by: string): Ticket {
  return {
    id,
    title,
    description: '',
    status: 'solved',
    priority: 'medium',
    category: 'Other',
    ticket_type: 'IT Support',
    created_by,
    assigned_to: null,
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
  } as unknown as Ticket
}

const USERS = [
  { id: 'steph', name: 'Stephanie Johnston', email: 'sjohnston@sfmc.com' },
  { id: 'team', name: 'Johnston Team', email: 'johnstonteam@sfmc.com' },
] as unknown as User[]

// Stephanie raised one ticket; the team inbox raised another she can open
// through her branch access.
const mine = ticket('T-1001', 'Printer jammed', 'steph')
const teamInbox = ticket('T-1372', 'Borrower payoff letter', 'team')

function search(term: string) {
  fireEvent.change(
    screen.getByPlaceholderText(/Search subject, description/i),
    { target: { value: term } },
  )
}

describe('TicketList search scope', () => {
  it("from My Tickets, finds a team-inbox ticket she didn't raise", () => {
    render(
      <TicketList
        tickets={[mine]}
        allTickets={[mine, teamInbox]}
        title="My Tickets"
        users={USERS}
      />,
    )
    // Before searching, the list is only her own ticket.
    expect(screen.queryByText('T-1372')).toBeNull()

    search('payoff')
    expect(screen.getByText('T-1372')).toBeTruthy()
    expect(screen.getByText(/searching all tickets/i)).toBeTruthy()
  })

  it('clearing the search goes back to just the list itself', () => {
    render(
      <TicketList
        tickets={[mine]}
        allTickets={[mine, teamInbox]}
        title="My Tickets"
        users={USERS}
      />,
    )
    search('payoff')
    search('')
    expect(screen.queryByText('T-1372')).toBeNull()
    expect(screen.getByText('T-1001')).toBeTruthy()
  })

  it('without a wider pool, search stays inside the list (previous behaviour)', () => {
    render(<TicketList tickets={[mine]} title="My Tickets" users={USERS} />)
    search('payoff')
    expect(screen.queryByText('T-1372')).toBeNull()
  })
})
