// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Ticket, User } from '@/types/ticket'

let currentPath = '/tickets/T-0001'
vi.mock('next/navigation', () => ({
  usePathname: () => currentPath,
}))

const { TicketQueueList } = await import(
  '@/components/tickets/ticket-queue-list'
)

function makeTickets(count: number): Ticket[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `T-${String(i + 1).padStart(4, '0')}`,
    title: `Ticket number ${i + 1}`,
    description: '',
    status: 'open',
    priority: 'medium',
    category: 'Other',
    ticket_type: 'IT Support',
    created_by: 'user-1',
    assigned_to: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })) as unknown as Ticket[]
}

const USERS = [{ id: 'user-1', name: 'Dana Crowley' }] as unknown as User[]

function setup(count: number) {
  return render(
    <TicketQueueList
      tickets={makeTickets(count)}
      users={USERS}
      title="Open Tickets"
    />,
  )
}

describe('ticket queue list — how much it draws', () => {
  it('draws the first 50 of a long view, not all of them', () => {
    currentPath = '/tickets/T-0001'
    setup(4189)
    expect(screen.getByText('Ticket number 50')).toBeInTheDocument()
    expect(screen.queryByText('Ticket number 51')).toBeNull()
  })

  it('still reports the true total in the header', () => {
    currentPath = '/tickets/T-0001'
    setup(4189)
    expect(screen.getByText('4189 tickets')).toBeInTheDocument()
  })

  it('offers to show more, and does', () => {
    currentPath = '/tickets/T-0001'
    setup(4189)
    fireEvent.click(screen.getByText(/Show 50 more/))
    expect(screen.getByText('Ticket number 100')).toBeInTheDocument()
    expect(screen.queryByText('Ticket number 101')).toBeNull()
  })

  it('KEEPS THE OPEN TICKET VISIBLE even when it sits far below the cut', () => {
    // Opening T-0900 from a search must not produce a queue that appears to
    // have lost the ticket the agent is reading.
    currentPath = '/tickets/T-0900'
    setup(4189)
    expect(screen.getByText('Ticket number 900')).toBeInTheDocument()
  })

  it('draws no "show more" control when the whole view fits', () => {
    currentPath = '/tickets/T-0001'
    setup(12)
    expect(screen.queryByText(/Show/)).toBeNull()
    expect(screen.getByText('Ticket number 12')).toBeInTheDocument()
  })

  it('keeps the empty state', () => {
    currentPath = '/tickets/T-0001'
    setup(0)
    expect(screen.getByText('No tickets in this view.')).toBeInTheDocument()
  })
})
