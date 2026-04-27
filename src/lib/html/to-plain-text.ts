/**
 * Convert HTML produced by the rich-text editor to plain text suitable
 * for email previews. Inserts line breaks for block-level tags, keeps
 * list bullets visible, drops everything else. Server-safe — no DOM.
 */
export function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return ''
  return (
    html
      // List items get a "- " prefix so bullets survive the round-trip.
      .replace(/<li[^>]*>/gi, '- ')
      // Block-level closers become newlines.
      .replace(/<\/(p|li|h1|h2|h3|blockquote|pre|div)>/gi, '\n')
      // Explicit <br> tags too.
      .replace(/<br\s*\/?>/gi, '\n')
      // Strip every remaining tag.
      .replace(/<[^>]+>/g, '')
      // Decode the most common entities we care about.
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // Collapse 3+ blank lines to 2 so emails don't sprawl.
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  )
}
