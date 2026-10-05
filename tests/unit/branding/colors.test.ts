import { describe, it, expect } from 'vitest'
import {
  DEFAULT_ACCENT_COLOR,
  DEFAULT_PRIMARY_COLOR,
  brandThemeCss,
  contrastRatio,
  normalizeHex,
  readableTextOn,
  resolveBrandColors,
} from '@/lib/branding/colors'

describe('normalizeHex', () => {
  it('accepts 3/6-digit hex with or without #', () => {
    expect(normalizeHex('#c98726')).toBe('#C98726')
    expect(normalizeHex('242e38')).toBe('#242E38')
    expect(normalizeHex('#abc')).toBe('#AABBCC')
  })
  it('rejects anything that could inject CSS', () => {
    expect(normalizeHex('red')).toBeNull()
    expect(normalizeHex('#123456;}body{display:none')).toBeNull()
    expect(normalizeHex(null)).toBeNull()
  })
})

describe('readable text on brand colours', () => {
  it('uses white on the SFMC slate primary', () => {
    expect(readableTextOn(DEFAULT_PRIMARY_COLOR)).toBe('#ffffff')
  })
  it('uses dark text on the SFMC gold, where white fails 4.5:1', () => {
    expect(contrastRatio(DEFAULT_ACCENT_COLOR, '#ffffff')).toBeLessThan(4.5)
    const text = readableTextOn(DEFAULT_ACCENT_COLOR)
    expect(text).toBe('#111827')
    expect(contrastRatio(DEFAULT_ACCENT_COLOR, text)).toBeGreaterThanOrEqual(4.5)
  })
})

describe('resolveBrandColors / brandThemeCss', () => {
  it('falls back to the SFMC colours when unset or invalid', () => {
    expect(resolveBrandColors(null, 'nope')).toEqual({
      primary: '#242E38',
      accent: '#C98726',
    })
  })
  it('emits the variables the portal reads', () => {
    const css = brandThemeCss({ primary: '#242e38', accent: '#c98726' })
    expect(css).toContain('--primary:#242E38')
    expect(css).toContain('--primary-foreground:#ffffff')
    expect(css).toContain('--brand-accent:#C98726')
    expect(css).toContain('--brand-accent-foreground:#111827')
  })
  it('never passes an unvalidated value through', () => {
    const css = brandThemeCss({ primary: '#000;}*{x:y', accent: '#fff' })
    expect(css).not.toContain('}*{')
    expect(css).toContain('--primary:#242E38')
  })
})
