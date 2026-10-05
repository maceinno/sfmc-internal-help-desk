/**
 * The portal's name comes from Admin → Branding (`branding_config.company_name`).
 * Everything that shows a name — sidebar, browser tab, sign-in page, emails —
 * reads it through here so there is one fallback, not one per screen.
 *
 * Pure: safe to import from client, server and tests.
 */

export const DEFAULT_BRAND_NAME = 'SFMC Help Desk'

/**
 * Placeholder the email templates write where the name goes. Templates are
 * synchronous and called from many places, so the name is filled in once,
 * in the single send path (`lib/email/notify.ts`), rather than threaded
 * through every template.
 */
export const BRAND_NAME_TOKEN = '{{brand_name}}'

/** Saved name, trimmed, or the default when blank / missing. */
export function resolveBrandName(saved: unknown): string {
  return typeof saved === 'string' && saved.trim() ? saved.trim() : DEFAULT_BRAND_NAME
}

/**
 * The box colour behind the logo, from the Branding "Logo Background"
 * choice: White Box → white, Custom → the picked colour, else none.
 */
export function logoBackgroundColor(
  background: unknown,
  customColor: unknown,
): string {
  if (background === 'white') return '#ffffff'
  if (background === 'custom' && typeof customColor === 'string' && customColor) {
    return customColor
  }
  return 'transparent'
}

/**
 * Placeholder for the email header: the logo when one is saved, otherwise
 * the name. Email headers are dark (#0f172a), like the sidebar.
 */
export const BRAND_HEADER_TOKEN = '{{brand_header}}'

export interface EmailBrand {
  name: string
  logoUrl?: string | null
  logoAlt?: string | null
  logoBackground?: unknown
  logoBackgroundColor?: unknown
}

function brandHeaderHtml(brand: EmailBrand): string {
  const name = escapeHtml(brand.name)
  if (!brand.logoUrl || !/^https:\/\//i.test(brand.logoUrl)) {
    return `<span style="color:#ffffff;font-size:18px;font-weight:700;">${name}</span>`
  }
  const bg = logoBackgroundColor(brand.logoBackground, brand.logoBackgroundColor)
  const alt = escapeHtml(brand.logoAlt || brand.name)
  // alt text styled like the old name, so a client that blocks images
  // still shows the name in the header.
  return `<span style="display:inline-block;background:${escapeHtml(bg)};border-radius:8px;padding:${bg === 'transparent' ? '0' : '6px 10px'};"><img src="${escapeHtml(brand.logoUrl)}" alt="${alt}" height="40" style="display:block;height:40px;width:auto;border:0;color:#ffffff;font-size:18px;font-weight:700;"></span>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Fill the name and logo into an email's subject (plain text) and body (HTML). */
export function applyEmailBranding(
  template: { subject: string; html: string },
  brand: EmailBrand,
): { subject: string; html: string } {
  return {
    subject: template.subject.split(BRAND_NAME_TOKEN).join(brand.name),
    html: template.html
      .split(BRAND_HEADER_TOKEN)
      .join(brandHeaderHtml(brand))
      .split(BRAND_NAME_TOKEN)
      .join(escapeHtml(brand.name)),
  }
}

/**
 * Put the brand name on a "from" address, keeping the mailbox.
 * `SFMC Help Desk <notifications@x.com>` → `"Acme Support" <notifications@x.com>`.
 * A bare address gains the name. The name is quoted, so commas or other
 * punctuation in it cannot break the header.
 */
export function withSenderName(from: string, name: string): string {
  const match = from.match(/<([^>]+)>\s*$/)
  const address = (match ? match[1] : from).trim()
  if (!address.includes('@')) return from
  const safe = name.replace(/["\\\r\n]/g, '').trim()
  return safe ? `"${safe}" <${address}>` : from
}
