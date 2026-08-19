import { describe, it, expect } from 'vitest'
import { ticketCreatedTeam, ticketRequeuedTeam, newReply } from '@/lib/email/templates'

const base = {
  ticketId: 'T-1042',
  title: 'Laptop will not connect to VPN',
  category: 'IT Support',
  priority: 'high',
  creatorName: 'Dana Reyes',
  teamName: 'IT Support',
}

describe('ticketCreatedTeam — request body', () => {
  it('includes the requester text in the team queue email', () => {
    const { html } = ticketCreatedTeam({
      ...base,
      description: '<p>VPN drops every time I join the Denver wifi.</p>',
    })

    expect(html).toContain('Request')
    expect(html).toContain('VPN drops every time I join the Denver wifi.')
    // Editor markup must not leak through into the email.
    expect(html).not.toContain('<p>VPN')
  })

  it('trims a long request and marks it as trimmed', () => {
    const long = 'x'.repeat(900)
    const { html } = ticketCreatedTeam({ ...base, description: long })

    expect(html).toContain('x'.repeat(500) + '...')
    expect(html).not.toContain('x'.repeat(501))
  })

  it('omits the request block entirely when there is no body', () => {
    expect(ticketCreatedTeam({ ...base }).html).not.toContain('>\n          Request\n')
    expect(
      ticketCreatedTeam({ ...base, description: '   ' }).html,
    ).not.toContain('Request</p>')
  })

  it('still shows ticket id, subject and the claim link', () => {
    const { html, subject } = ticketCreatedTeam({
      ...base,
      description: 'Something broke.',
    })
    expect(subject).toContain('T-1042')
    expect(html).toContain('T-1042')
    expect(html).toContain('Laptop will not connect to VPN')
    expect(html).toContain('View & Claim')
  })
})

describe('ticketRequeuedTeam — request body', () => {
  const requeued = {
    ticketId: 'T-1042',
    title: 'Laptop will not connect to VPN',
    category: 'IT Support',
    priority: 'high',
    teamName: 'IT Support',
    formerAgentName: 'Sam Patel',
  }

  it('includes the requester text when a ticket returns to the queue', () => {
    const { html } = ticketRequeuedTeam({
      ...requeued,
      description: '<p>VPN drops every time I join the Denver wifi.</p>',
    })

    expect(html).toContain('Request')
    expect(html).toContain('VPN drops every time I join the Denver wifi.')
    expect(html).not.toContain('<p>VPN')
  })

  it('trims at the same 500 characters as the new-ticket email', () => {
    const long = 'x'.repeat(900)
    const requeuedHtml = ticketRequeuedTeam({ ...requeued, description: long }).html
    const createdHtml = ticketCreatedTeam({ ...base, description: long }).html

    expect(requeuedHtml).toContain('x'.repeat(500) + '...')
    expect(requeuedHtml).not.toContain('x'.repeat(501))
    // Both queue emails must trim identically.
    expect(requeuedHtml.includes('x'.repeat(500) + '...')).toBe(
      createdHtml.includes('x'.repeat(500) + '...'),
    )
  })

  it('omits the request block entirely when there is no body', () => {
    expect(ticketRequeuedTeam({ ...requeued }).html).not.toContain('Request</p>')
    expect(
      ticketRequeuedTeam({ ...requeued, description: '   ' }).html,
    ).not.toContain('Request</p>')
  })

  it('still names the deactivated agent and keeps the claim link', () => {
    const { html, subject } = ticketRequeuedTeam({
      ...requeued,
      description: 'Something broke.',
    })
    expect(subject).toContain('Back in IT Support queue')
    expect(html).toContain('Sam Patel')
    expect(html).toContain('Ticket Returned to Your Team Queue')
    expect(html).toContain('View & Claim')
  })
})

describe('newReply — original request block unchanged', () => {
  it('keeps trimming the original request at 300 characters', () => {
    const { html } = newReply({
      ticketId: 'T-1042',
      title: 'Laptop will not connect to VPN',
      authorName: 'Sam Patel',
      content: 'Have you tried the guest network?',
      isInternal: false,
      description: 'y'.repeat(600),
    })

    expect(html).toContain('Original Request')
    expect(html).toContain('y'.repeat(300) + '...')
    expect(html).not.toContain('y'.repeat(301))
  })
})
