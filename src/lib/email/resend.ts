import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY)

// Default "from" address — must be a verified domain in Resend
export const EMAIL_FROM = process.env.EMAIL_FROM ?? 'SFMC Help Desk <notifications@support.sfmc.com>'

// Inbound email domain — replies to ticket notifications go here
export const INBOUND_DOMAIN = process.env.INBOUND_EMAIL_DOMAIN ?? 'support.sfmc.com'

/**
 * Generate the Reply-To address for a ticket.
 * Format: ticket+T-1064@support.sfmc.com
 * The webhook parses the ticket ID from the + segment.
 */
export function ticketReplyTo(ticketId: string): string {
  return `ticket+${ticketId}@${INBOUND_DOMAIN}`
}
