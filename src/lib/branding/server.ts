import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { resolveBrandName } from './brand-name'
import { resolveBrandColors, type BrandColors } from './colors'

export interface ServerBranding {
  name: string
  logoUrl: string | null
  logoAlt: string
  logoBackground: string | null
  logoBackgroundColor: string | null
  colors: BrandColors
}

const TTL_MS = 60_000
let cached: { at: number; value: ServerBranding } | null = null

/**
 * The saved Admin → Branding row, for server code (page metadata, the
 * sign-in page, emails). Read with the service-role client because the
 * sign-in page and email jobs have no signed-in user. Held for 60 s per
 * server instance, so a save shows up within a minute.
 *
 * Never throws: a failed read falls back to the defaults, because no name
 * or logo is worth breaking a page or dropping an email over.
 */
export async function getServerBranding(): Promise<ServerBranding> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value

  let row: Record<string, unknown> | null = null
  try {
    const { data, error } = await createAdminClient()
      .from('branding_config')
      .select(
        'company_name, logo_url, logo_alt, logo_background, logo_background_color, primary_color, accent_color',
      )
      .limit(1)
      .maybeSingle()
    if (error) console.error('[branding] read failed:', error.message)
    row = data
  } catch (err) {
    console.error('[branding] read failed:', err)
  }

  const name = resolveBrandName(row?.company_name)
  const value: ServerBranding = {
    name,
    logoUrl: (row?.logo_url as string) || null,
    logoAlt: (row?.logo_alt as string) || name,
    logoBackground: (row?.logo_background as string) ?? null,
    logoBackgroundColor: (row?.logo_background_color as string) ?? null,
    colors: resolveBrandColors(row?.primary_color, row?.accent_color),
  }
  // Only cache a real read, so a transient failure is retried next request.
  if (row) cached = { at: Date.now(), value }
  return value
}
