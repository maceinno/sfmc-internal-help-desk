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
 * Expects format: ticket+T-1064@reply.sfmc.com
 * Returns the ticket ID (e.g., "T-1064") or null.
 */
export function extractTicketId(address: string): string | null {
  // Match ticket+TICKET_ID@domain
  const match = address.match(/ticket\+([^@]+)@/)
  return match ? match[1] : null
}

/**
 * Parse an inbound email's HTML body down to the new reply text.
 *
 * Gmail/Outlook/Apple wrap the quoted history in predictable containers;
 * truncating the HTML at the first such marker drops the quoted history
 * AND the signature block that typically sits between the reply and the
 * quote. Remaining HTML is converted to plain text and passed through the
 * text parser for any stray signature/quote lines.
 */
export function parseHtmlReply(html: string): string {
  // Strip scripts/styles wholesale — they can contain tag-like noise.
  let working = html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')

  // Truncate at the first known quote/reply-history marker.
  const quoteMarkers = [
    /<div[^>]*class="[^"]*gmail_quote[^"]*"/i,
    /<blockquote[^>]*class="[^"]*gmail_quote[^"]*"/i,
    /<blockquote[^>]*type="cite"/i,
    /<div[^>]*id="divRplyFwdMsg"/i,
    /<div[^>]*id="appendonsend"/i,
    /<div[^>]*class="[^"]*OutlookMessageHeader[^"]*"/i,
  ]
  let cutoff = working.length
  for (const re of quoteMarkers) {
    const m = re.exec(working)
    if (m && m.index < cutoff) cutoff = m.index
  }
  working = working.slice(0, cutoff)

  // Drop Gmail's signature block (everything from the signature div onward).
  working = working.replace(/<div[^>]*class="[^"]*gmail_signature[^"]*"[\s\S]*$/i, '')

  // Convert structural tags to whitespace, then strip the rest.
  const text = working
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n\n')
    .replace(/<\/div\s*>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')

  // Run through the text parser for remaining signature markers etc.
  return parseReplyContent(text)
}
