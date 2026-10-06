import { Resend } from 'resend'

let client: Resend | null = null
function getResend(): Resend {
  return (client ??= new Resend(process.env.RESEND_API_KEY))
}
// Lazy: constructed on first use, so `next build` with no env vars does not throw (MF-1366).
export const resend = new Proxy({} as Resend, {
  get: (_t, prop) => Reflect.get(getResend(), prop),
})

// Default "from" address — must be a verified domain in Resend
export const EMAIL_FROM = process.env.EMAIL_FROM ?? 'SFMC Help Desk <notifications@support.sfmc.com>'

// Inbound email domain — replies to ticket notifications go here
// Uses a separate subdomain (reply.sfmc.com) to avoid CNAME/MX conflict on support.sfmc.com
export const INBOUND_DOMAIN = process.env.INBOUND_EMAIL_DOMAIN ?? 'reply.sfmc.com'

/**
 * Generate the Reply-To address for a ticket.
 * Format: ticket+T-1064@reply.sfmc.com
 * The webhook parses the ticket ID from the + segment.
 */
export function ticketReplyTo(ticketId: string): string {
  return `ticket+${ticketId}@${INBOUND_DOMAIN}`
}
