#!/usr/bin/env node
// Re-mint a 7-day Clerk sign-in token for each user in a Clerk instance
// and email them a welcome link via Resend. Used after a dev → prod
// migration: every previously-issued sign-in token was minted by the dev
// instance and is invalid against prod.
//
// Usage:
//   CLERK_SECRET_KEY=sk_live_xxx \
//   RESEND_API_KEY=re_xxx \
//   EMAIL_FROM='SFMC Help Desk <support@support.sfmc.com>' \
//   APP_URL=https://support.sfmc.com \
//     node scripts/clerk-resend-welcome.mjs [--dry-run] [--limit N] [--filter-external-id-only]
//
// Flags:
//   --dry-run                  fetch + count, do NOT send any tokens or emails
//   --limit N                  process at most N users (useful for a smoke test)
//   --filter-external-id-only  only email users that have an external_id set
//                              (i.e., migrated users, not those created
//                              natively in this instance after the cutover)

import { setTimeout as sleep } from 'node:timers/promises'

const CLERK_API = 'https://api.clerk.com/v1'
const SECRET = process.env.CLERK_SECRET_KEY
const RESEND_KEY = process.env.RESEND_API_KEY
const EMAIL_FROM = process.env.EMAIL_FROM
const APP_URL = process.env.APP_URL

if (!SECRET) {
  console.error('CLERK_SECRET_KEY env var is required (use sk_live_* for prod)')
  process.exit(1)
}

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const limitIdx = args.indexOf('--limit')
const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity
const filterMigratedOnly = args.includes('--filter-external-id-only')

if (!dryRun) {
  if (!RESEND_KEY || !EMAIL_FROM || !APP_URL) {
    console.error(
      'For a live run, RESEND_API_KEY, EMAIL_FROM, and APP_URL are all required.',
    )
    process.exit(1)
  }
}

async function clerk(method, path, body) {
  const res = await fetch(`${CLERK_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${SECRET}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Clerk ${method} ${path} -> ${res.status}: ${text}`)
  }
  return res.json()
}

async function listAllUsers() {
  const PAGE = 500
  let offset = 0
  const all = []
  for (;;) {
    const batch = await clerk('GET', `/users?limit=${PAGE}&offset=${offset}`)
    if (!Array.isArray(batch) || batch.length === 0) break
    all.push(...batch)
    if (batch.length < PAGE) break
    offset += PAGE
  }
  return all
}

function primaryEmail(u) {
  if (!u.email_addresses?.length) return null
  if (u.primary_email_address_id) {
    const m = u.email_addresses.find((e) => e.id === u.primary_email_address_id)
    if (m?.email_address) return m.email_address
  }
  return u.email_addresses[0].email_address ?? null
}

function fullName(u) {
  const parts = [u.first_name, u.last_name].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : (primaryEmail(u) ?? 'there')
}

async function createSignInToken(clerkUserId) {
  return clerk('POST', '/sign_in_tokens', {
    user_id: clerkUserId,
    expires_in_seconds: 7 * 24 * 60 * 60,
  })
}

async function sendWelcomeEmail({ to, name, url }) {
  const subject = 'Welcome to the SFMC Help Desk'
  const html = `
    <p>Hi ${escapeHtml(name)},</p>
    <p>Your SFMC Help Desk account is ready. Click the button below to sign in — no password needed. The link is good for 7 days.</p>
    <p style="margin:24px 0;">
      <a href="${escapeAttr(url)}" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block;">
        Sign in to the Help Desk
      </a>
    </p>
    <p style="color:#666;font-size:13px;">If the button doesn't work, paste this URL into your browser:<br>${escapeHtml(url)}</p>
  `.trim()
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: EMAIL_FROM, to, subject, html }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Resend send -> ${res.status}: ${text}`)
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
}
function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;')
}

async function main() {
  const isProd = SECRET.startsWith('sk_live_')
  console.error(`[resend] Targeting ${isProd ? 'PRODUCTION' : 'development'} Clerk instance.`)
  if (!isProd && !dryRun) {
    console.error('[resend] Refusing to send emails against a non-production Clerk instance. Re-run with --dry-run.')
    process.exit(1)
  }

  const users = await listAllUsers()
  let queue = users
  if (filterMigratedOnly) {
    queue = queue.filter((u) => Boolean(u.external_id))
  }
  if (queue.length > limit) queue = queue.slice(0, limit)

  console.error(`[resend] ${users.length} total users; ${queue.length} queued for welcome email${dryRun ? ' (dry-run)' : ''}.`)

  let sent = 0
  const failed = []
  for (const u of queue) {
    const email = primaryEmail(u)
    if (!email) {
      failed.push({ id: u.id, reason: 'no email' })
      continue
    }
    if (dryRun) {
      console.error(`[resend] DRY: would email ${email} (clerk ${u.id}, ext ${u.external_id ?? '—'})`)
      continue
    }
    try {
      const token = await createSignInToken(u.id)
      const signInUrl = `${APP_URL}/sign-in?__clerk_ticket=${encodeURIComponent(token.token)}`
      await sendWelcomeEmail({ to: email, name: fullName(u), url: signInUrl })
      sent += 1
      console.error(`[resend] sent → ${email}`)
      // Be polite to both APIs.
      await sleep(150)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      failed.push({ id: u.id, email, reason: msg })
      console.error(`[resend] FAILED → ${email}: ${msg}`)
    }
  }

  console.error('---')
  console.error(`[resend] sent=${sent} failed=${failed.length} skipped=${users.length - queue.length}`)
  if (failed.length > 0) {
    console.error('[resend] Failures:')
    for (const f of failed) console.error(`  - ${f.email ?? f.id}: ${f.reason}`)
  }
}

main().catch((err) => {
  console.error('[resend] FAILED:', err)
  process.exit(1)
})
