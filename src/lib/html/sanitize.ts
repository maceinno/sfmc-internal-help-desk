import DOMPurify from 'dompurify'

/**
 * Allowed tags / attributes for rich-text we accept from the editor and
 * render back into the UI. Intentionally small — no scripts, no styles.
 * <img> is permitted so embedded images in inbound emails render and so
 * future Storage-hosted attachments can be inlined; src URIs are
 * restricted to http(s) by ALLOWED_URI_REGEXP below to keep data:/javascript:
 * out and to prevent multi-MB clipboard data URIs from bloating ticket rows.
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
  // Tiptap mention nodes render as <span data-type="mention" data-id="...">.
  'span',
]

const ALLOWED_ATTRS = [
  'href',
  'target',
  'rel',
  'src',
  'alt',
  'width',
  'height',
  'loading',
  'referrerpolicy',
  // Mention attributes — needed so we can extract tagged user ids from
  // saved HTML and so the mention chip styling survives sanitization.
  'class',
  'data-type',
  'data-id',
  'data-label',
]

// http(s), mailto, tel, cid (email-embedded images), or scheme-less
// (relative/anchor) refs. Blocks data: and javascript:.
const SAFE_URI_REGEXP = /^(?:https?:|mailto:|tel:|cid:|#|\/|[^a-z]|$)/i

let imgHookRegistered = false
function ensureImgHook() {
  if (imgHookRegistered) return
  // Force tracking-pixel mitigations on every <img> we render.
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if ((node as Element).tagName === 'IMG') {
      ;(node as Element).setAttribute('loading', 'lazy')
      ;(node as Element).setAttribute('referrerpolicy', 'no-referrer')
    }
  })
  imgHookRegistered = true
}

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
  ensureImgHook()
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ALLOWED_ATTRS,
    ALLOWED_URI_REGEXP: SAFE_URI_REGEXP,
  })
  // Force safe link rels via a quick post-process so external links
  // open in a new tab without sharing the opener.
  return clean.replace(
    /<a (?![^>]*\brel=)/g,
    '<a rel="noopener noreferrer" target="_blank" ',
  )
}
