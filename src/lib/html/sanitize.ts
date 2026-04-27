import DOMPurify from 'dompurify'

/**
 * Allowed tags / attributes for rich-text we accept from the editor and
 * render back into the UI. Intentionally small — no scripts, no styles. Inline images are
 * allowed so pasted screenshots render correctly. Mirrors what the Tiptap toolbar can produce.
 */
const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'ul',
  'ol',
  'li',
  'a',
  'code',
  'pre',
  'blockquote',
  'h1',
  'h2',
  'h3',
  'img',
]

const ALLOWED_ATTRS = ['href', 'target', 'rel', 'src', 'alt', 'width', 'height']

/**
 * Sanitize HTML coming from a rich-text editor or pasted source. Client
 * use only — runs on the browser DOM. We sanitize at two points: when
 * the editor's content updates (before we set the form value) and again
 * when we render stored HTML, so a malicious string in the DB can't
 * inject scripts.
 */
export function sanitizeRichHtml(html: string): string {
  if (!html) return ''
  if (typeof window === 'undefined') {
    // No DOM here — fall back to stripping tags entirely so server-side
    // accidental rendering can't execute anything.
    return html.replace(/<[^>]*>/g, '')
  }
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ALLOWED_ATTRS,
  })
  // Force safe link rels via a quick post-process so external links
  // open in a new tab without sharing the opener.
  return clean.replace(
    /<a (?![^>]*\brel=)/g,
    '<a rel="noopener noreferrer" target="_blank" ',
  )
}
