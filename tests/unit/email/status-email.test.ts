// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { shouldSendStatusEmail } from '@/lib/email/status-email'
import * as templates from '@/lib/email/templates'

describe('shouldSendStatusEmail', () => {
  it('sends for a status change made on its own (sidebar, or the composer status button)', () => {
    expect(
      shouldSendStatusEmail({ oldStatus: 'open', newStatus: 'solved' }),
    ).toBe(true)
    expect(
      shouldSendStatusEmail({
        oldStatus: 'open',
        newStatus: 'solved',
        sentWithReply: false,
      }),
    ).toBe(true)
  })

  // The duplicate the client reported: reply-as-solved sent the reply email
  // and then a status email 2-3 seconds later, to the same person.
  it('does NOT send when a reply already carried the status change', () => {
    expect(
      shouldSendStatusEmail({
        oldStatus: 'open',
        newStatus: 'solved',
        sentWithReply: true,
      }),
    ).toBe(false)
  })

  it('never sends when nothing actually moved', () => {
    expect(
      shouldSendStatusEmail({ oldStatus: 'solved', newStatus: 'solved' }),
    ).toBe(false)
  })

  it('never sends on incomplete input', () => {
    expect(shouldSendStatusEmail({ newStatus: 'solved' })).toBe(false)
    expect(shouldSendStatusEmail({ oldStatus: 'open' })).toBe(false)
    expect(shouldSendStatusEmail({})).toBe(false)
  })
})

describe('reply email carries the status change', () => {
  const base = {
    ticketId: 'T-4732',
    title: 'Easterly Locks',
    authorName: 'Jane Agent',
    content: 'I have added the escrow waiver and adjusted pricing.',
    isInternal: false,
  }

  it('names the new status when the reply changed it', () => {
    const { html } = templates.newReply({ ...base, statusChangedTo: 'solved' })
    expect(html).toContain('This reply also set the ticket status to')
    expect(html).toContain('Solved')
  })

  it('spells multi-word statuses properly', () => {
    const { html } = templates.newReply({ ...base, statusChangedTo: 'on_hold' })
    expect(html).toContain('On Hold')
    expect(html).not.toContain('on_hold')
  })

  it('leaves a plain reply email untouched', () => {
    const { html } = templates.newReply(base)
    expect(html).not.toContain('This reply also set the ticket status to')
  })

  it('still reads as a reply, not a status notification', () => {
    const { subject } = templates.newReply({
      ...base,
      statusChangedTo: 'solved',
    })
    expect(subject).toBe('Re: [T-4732] Easterly Locks')
  })

  // CC'd followers get a different template built from the same body, and
  // they are in the audience the suppressed status email used to reach.
  it("carries the status into a CC'd follower's copy too", () => {
    const { html } = templates.ccNotification({
      ...base,
      statusChangedTo: 'solved',
    })
    expect(html).toContain('This reply also set the ticket status to')
    expect(html).toContain('Solved')
    expect(html).toContain("CC'd Ticket Update")
  })
})
