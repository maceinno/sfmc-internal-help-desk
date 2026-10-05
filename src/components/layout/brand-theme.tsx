'use client'

import { useBranding } from '@/hooks/use-admin-config'
import { brandThemeCss, resolveBrandColors, type BrandColors } from '@/lib/branding/colors'

/**
 * Applies the Admin → Branding colours. `initial` comes from the server so
 * the first paint is already in brand colours; once the branding query
 * loads (and again after a save on the Branding page) it takes over, so a
 * change shows without a reload.
 */
export function BrandTheme({ initial }: { initial: BrandColors }) {
  const { data } = useBranding()
  const colors = data
    ? resolveBrandColors(data.primary_color, data.accent_color)
    : initial
  return <style>{brandThemeCss(colors)}</style>
}
