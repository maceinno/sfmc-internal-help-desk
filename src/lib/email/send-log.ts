/**
 * One row of `email_send_log` (migration 023): an email the help desk tried
 * to send and what Resend answered.
 *
 * Lives outside notify.ts (which is `server-only`) so the mapping can be
 * tested without a database or a mail client — the same split
 * reply-recipients.ts and status-email.ts use.
 */

export type SendOutcome = 'accepted' | 'refused' | 'error'

export interface SendLogRow {
  recipient: string
  subject: string | null
  ticket_id: string | null
  outcome: SendOutcome
  resend_email_id: string | null
  error_name: string | null
  error_message: string | null
}

const MAX_ERROR_LENGTH = 1000

function clip(s: string | null | undefined): string | null {
  if (!s) return null
  return s.length > MAX_ERROR_LENGTH ? s.slice(0, MAX_ERROR_LENGTH) : s
}

export function buildSendLogRow(p: {
  to: string
  subject?: string | null
  ticketId?: string | null
  /** What `resend.emails.send` returned, when it returned. */
  result?: {
    data?: { id?: string } | null
    error?: { name?: string; message?: string } | null
  }
  /** What it threw, when it threw. */
  thrown?: unknown
}): SendLogRow {
  const base = {
    recipient: p.to.trim().toLowerCase(),
    subject: p.subject ?? null,
    ticket_id: p.ticketId ?? null,
  }

  if (p.thrown !== undefined) {
    const err = p.thrown
    return {
      ...base,
      outcome: 'error',
      resend_email_id: null,
      error_name: err instanceof Error ? err.name : 'Error',
      error_message: clip(err instanceof Error ? err.message : String(err)),
    }
  }

  const error = p.result?.error
  if (error) {
    return {
      ...base,
      outcome: 'refused',
      resend_email_id: null,
      error_name: error.name ?? null,
      error_message: clip(error.message ?? JSON.stringify(error)),
    }
  }

  return {
    ...base,
    outcome: 'accepted',
    resend_email_id: p.result?.data?.id ?? null,
    error_name: null,
    error_message: null,
  }
}
