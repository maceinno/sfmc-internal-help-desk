import { describe, it, expect } from 'vitest'
import { buildSendLogRow } from '@/lib/email/send-log'

describe('buildSendLogRow', () => {
  it('records an accepted send with Resend’s id', () => {
    const row = buildSendLogRow({
      to: ' FPena@sfmc.com ',
      subject: 'Re: [T-1] Hello',
      ticketId: 'T-1',
      result: { data: { id: 're_123' }, error: null },
    })
    expect(row).toEqual({
      recipient: 'fpena@sfmc.com',
      subject: 'Re: [T-1] Hello',
      ticket_id: 'T-1',
      outcome: 'accepted',
      resend_email_id: 're_123',
      error_name: null,
      error_message: null,
    })
  })

  it('records a refusal with Resend’s reason', () => {
    const row = buildSendLogRow({
      to: 'a@b.com',
      subject: 'x',
      result: {
        data: null,
        error: { name: 'validation_error', message: 'Invalid `to` field.' },
      },
    })
    expect(row.outcome).toBe('refused')
    expect(row.error_name).toBe('validation_error')
    expect(row.error_message).toBe('Invalid `to` field.')
    expect(row.resend_email_id).toBeNull()
    expect(row.ticket_id).toBeNull()
  })

  it('records a thrown error, even a non-Error value', () => {
    expect(buildSendLogRow({ to: 'a@b.com', thrown: new TypeError('fetch failed') })).toMatchObject({
      outcome: 'error',
      error_name: 'TypeError',
      error_message: 'fetch failed',
    })
    expect(buildSendLogRow({ to: 'a@b.com', thrown: 'boom' })).toMatchObject({
      outcome: 'error',
      error_message: 'boom',
    })
  })

  it('clips a very long error message', () => {
    const row = buildSendLogRow({ to: 'a@b.com', thrown: new Error('x'.repeat(5000)) })
    expect(row.error_message).toHaveLength(1000)
  })
})
