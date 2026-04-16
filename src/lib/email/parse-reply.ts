/**
 * Extract only the new reply text from an email body,
 * stripping quoted previous messages and signatures.
 *
 * Handles common email client patterns:
 * - "On <date>, <name> wrote:" (Gmail, Apple Mail)
 * - "From: <email>" header blocks (Outlook)
 * - "---" or "___" signature separators
 * - "> " quote prefixes
 * - "-- " signature marker (RFC 3676)
 */
export function parseReplyContent(text: string): string {
  const lines = text.split('\n')
  const resultLines: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()

    // Stop at common reply headers
    if (/^On .+ wrote:$/i.test(trimmed)) break
    if (/^-{3,}[\s]*Original Message[\s]*-{3,}$/i.test(trimmed)) break
    if (/^From:\s/i.test(trimmed)) break
    if (/^Sent:\s/i.test(trimmed)) break

    // Stop at signature markers
    if (trimmed === '-- ') break // RFC 3676 sig separator
    if (/^-{3,}$/.test(trimmed)) break
    if (/^_{3,}$/.test(trimmed)) break

    // Stop at quoted lines (but allow a few — some people quote inline)
    if (trimmed.startsWith('>')) break

    // Stop at "Conversation History" from our own templates
    if (trimmed === 'Conversation History') break

    resultLines.push(line)
  }

  // Trim trailing empty lines
  while (resultLines.length > 0 && resultLines[resultLines.length - 1].trim() === '') {
    resultLines.pop()
  }

  return resultLines.join('\n').trim()
}

/**
 * Extract the ticket ID from a Reply-To or To address.
 * Expects format: ticket+T-1064@support.sfmc.com
 * Returns the ticket ID (e.g., "T-1064") or null.
 */
export function extractTicketId(address: string): string | null {
  // Match ticket+TICKET_ID@domain
  const match = address.match(/ticket\+([^@]+)@/)
  return match ? match[1] : null
}
