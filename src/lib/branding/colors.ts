/**
 * Brand colours from Admin → Branding, applied as CSS variables.
 *
 *   Primary → shadcn `--primary` (every default <Button>, `bg-primary`, `text-primary`)
 *   Accent  → `--brand-accent` (the highlighted sidebar item)
 *
 * The text colour on each is picked for contrast, never assumed white:
 * white on the SFMC gold (#C98726) is ~3:1, below the 4.5:1 body-text bar.
 *
 * Pure: safe to import from client, server and tests.
 */

/** Client brand colours, given 2026-10-05. Gold matches the logo exactly. */
export const DEFAULT_PRIMARY_COLOR = '#242E38'
export const DEFAULT_ACCENT_COLOR = '#C98726'

const DARK_TEXT = '#111827'
const LIGHT_TEXT = '#ffffff'

/** `#abc` / `#aabbcc` (any case) → `#AABBCC`; anything else → null. */
export function normalizeHex(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const m = value.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (!m) return null
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1]
  return `#${h.toUpperCase()}`
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** White or near-black, whichever reads better on `background`. */
export function readableTextOn(background: string): string {
  return contrastRatio(background, LIGHT_TEXT) >= contrastRatio(background, DARK_TEXT)
    ? LIGHT_TEXT
    : DARK_TEXT
}

export interface BrandColors {
  primary: string
  accent: string
}

/** Saved values, or the defaults when blank / not a hex colour. */
export function resolveBrandColors(primary: unknown, accent: unknown): BrandColors {
  return {
    primary: normalizeHex(primary) ?? DEFAULT_PRIMARY_COLOR,
    accent: normalizeHex(accent) ?? DEFAULT_ACCENT_COLOR,
  }
}

/** The `:root` rule that applies the colours. Inputs are re-validated here. */
export function brandThemeCss(colors: BrandColors): string {
  const { primary, accent } = resolveBrandColors(colors.primary, colors.accent)
  return `:root{--primary:${primary};--primary-foreground:${readableTextOn(primary)};--brand-accent:${accent};--brand-accent-foreground:${readableTextOn(accent)};}`
}
