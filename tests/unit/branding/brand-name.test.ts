import { describe, it, expect } from 'vitest'
import {
  BRAND_HEADER_TOKEN,
  BRAND_NAME_TOKEN,
  DEFAULT_BRAND_NAME,
  applyEmailBranding,
  logoBackgroundColor,
  resolveBrandName,
  withSenderName,
} from '@/lib/branding/brand-name'
import { welcomeUser, ticketCreatedTeam } from '@/lib/email/templates'

describe('resolveBrandName', () => {
  it('uses the saved name, trimmed', () => {
    expect(resolveBrandName('  Acme Support ')).toBe('Acme Support')
  })
  it('falls back when blank or missing', () => {
    expect(resolveBrandName('')).toBe(DEFAULT_BRAND_NAME)
    expect(resolveBrandName('   ')).toBe(DEFAULT_BRAND_NAME)
    expect(resolveBrandName(null)).toBe(DEFAULT_BRAND_NAME)
    expect(resolveBrandName(undefined)).toBe(DEFAULT_BRAND_NAME)
  })
})

describe('withSenderName', () => {
  it('replaces the display name and keeps the mailbox', () => {
    expect(
      withSenderName('SFMC Help Desk <notifications@support.sfmc.com>', 'Acme, Inc.'),
    ).toBe('"Acme, Inc." <notifications@support.sfmc.com>')
  })
  it('adds a name to a bare address', () => {
    expect(withSenderName('a@b.com', 'Acme')).toBe('"Acme" <a@b.com>')
  })
  it('strips characters that would break the header', () => {
    expect(withSenderName('a@b.com', 'Ac"me\r\n')).toBe('"Acme" <a@b.com>')
  })
})

describe('logoBackgroundColor', () => {
  it('maps each Branding choice', () => {
    expect(logoBackgroundColor('white', '#123456')).toBe('#ffffff')
    expect(logoBackgroundColor('custom', '#123456')).toBe('#123456')
    expect(logoBackgroundColor('transparent', '#123456')).toBe('transparent')
    expect(logoBackgroundColor(null, null)).toBe('transparent')
  })
})

describe('email templates carry no hard-coded name', () => {
  const samples = [
    welcomeUser({ name: 'Dana Reyes', role: 'agent', signInUrl: 'https://x/y' }),
    ticketCreatedTeam({
      ticketId: 'T-1',
      title: 't',
      category: 'c',
      priority: 'low',
      creatorName: 'n',
      teamName: 'IT',
    }),
  ]

  it('uses the placeholders, never the old literal', () => {
    for (const t of samples) {
      expect(t.html).not.toContain('SFMC Help Desk')
      expect(t.html).toContain(BRAND_HEADER_TOKEN)
      expect(t.html).toContain(BRAND_NAME_TOKEN)
    }
    expect(samples[0].subject).toContain(BRAND_NAME_TOKEN)
  })

  it('fills name and logo, escaping the name', () => {
    const out = applyEmailBranding(samples[0], {
      name: 'A&B <Lending>',
      logoUrl: 'https://cdn.example.com/logo.png',
      logoAlt: 'A&B logo',
      logoBackground: 'transparent',
    })
    expect(out.subject).toBe('Welcome to A&B <Lending> — set up your account')
    expect(out.html).toContain('A&amp;B &lt;Lending&gt;')
    expect(out.html).toContain('src="https://cdn.example.com/logo.png"')
    expect(out.html).not.toContain(BRAND_NAME_TOKEN)
    expect(out.html).not.toContain(BRAND_HEADER_TOKEN)
  })

  it('shows the name in the header when there is no logo', () => {
    const out = applyEmailBranding(samples[1], { name: 'Acme Support' })
    expect(out.html).not.toContain('<img')
    expect(out.html).toContain('font-weight:700;">Acme Support</span>')
  })
})
