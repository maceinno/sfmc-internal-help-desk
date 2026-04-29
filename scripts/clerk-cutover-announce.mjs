#!/usr/bin/env node
// One-shot announcement email for the dev → prod Clerk cutover.
// Reads dev-users.json (the migration-tool export) and sends a short
// "tech change tonight" note via Resend.
//
//   RESEND_API_KEY=re_xxx \
//   EMAIL_FROM='SFMC Help Desk <notifications@support.sfmc.com>' \
//   node scripts/clerk-cutover-announce.mjs --dry-run
//
//   ... then drop --dry-run to actually send.
//
// Flags:
//   --dry-run            print what would send, send nothing
//   --limit=N            cap to first N recipients (handy for testing)
//   --only=email1,email2 send only to listed addresses
//   --file=path          override dev-users.json path

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const args = process.argv.slice(2)
const flag = (name) => args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`))
const flagVal = (name) => {
  const f = flag(name)
  if (!f) return undefined
  const eq = f.indexOf('=')
  return eq === -1 ? '' : f.slice(eq + 1)
}

const DRY_RUN = Boolean(flag('dry-run'))
const LIMIT = flagVal('limit') ? Number(flagVal('limit')) : undefined
const ONLY = flagVal('only')?.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean) ?? []
const SKIP = flagVal('skip')?.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean) ?? []
const FILE = flagVal('file') ?? resolve(process.cwd(), 'dev-users.json')

const RESEND_KEY = process.env.RESEND_API_KEY
const EMAIL_FROM = process.env.EMAIL_FROM ?? 'SFMC Help Desk <notifications@support.sfmc.com>'

if (!DRY_RUN && !RESEND_KEY) {
  console.error('Missing RESEND_API_KEY (set it, or use --dry-run).')
  process.exit(1)
}

const raw = readFileSync(FILE, 'utf8')
let users = JSON.parse(raw)

// Filter
if (ONLY.length > 0) {
  users = users.filter((u) => ONLY.includes((u.email ?? '').toLowerCase()))
}
if (SKIP.length > 0) {
  users = users.filter((u) => !SKIP.includes((u.email ?? '').toLowerCase()))
}
if (LIMIT) users = users.slice(0, LIMIT)

const SUBJECT = 'Heads-up: SFMC Help Desk update tonight'

const buildHtml = (firstName) => `<!doctype html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; max-width: 560px; margin: 0 auto; padding: 24px; line-height: 1.5;">
  <p>Hi ${firstName || 'there'},</p>
  <p>Quick heads-up — we're making a small technical update to the SFMC Help Desk in the next 30 minutes.</p>
  <p><strong>What you may notice:</strong></p>
  <ul>
    <li>You'll likely need to sign in again the next time you open <a href="https://support.sfmc.com">support.sfmc.com</a>.</li>
    <li>Sign-in is exactly the same as always — enter your email, then the 6-digit verification code we send you.</li>
    <li>All your tickets, replies, and history are unaffected.</li>
  </ul>
  <p>If you run into anything unexpected, just reply to this email or open a ticket once you're back in.</p>
  <p>Thanks,<br/>SFMC Help Desk</p>
</body></html>`

const buildText = (firstName) => `Hi ${firstName || 'there'},

Quick heads-up — we're making a small technical update to the SFMC Help Desk in the next 30 minutes.

What you may notice:
  - You'll likely need to sign in again the next time you open support.sfmc.com.
  - Sign-in is exactly the same as always — enter your email, then the 6-digit verification code we send you.
  - All your tickets, replies, and history are unaffected.

If you run into anything unexpected, just reply to this email or open a ticket once you're back in.

Thanks,
SFMC Help Desk
`

async function send(to, firstName) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to,
      subject: SUBJECT,
      html: buildHtml(firstName),
      text: buildText(firstName),
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Resend ${res.status}: ${body}`)
  }
  return res.json()
}

console.log(`Recipients: ${users.length}${DRY_RUN ? ' (DRY RUN — nothing sent)' : ''}`)
console.log(`Subject: ${SUBJECT}`)
console.log(`From: ${EMAIL_FROM}`)
console.log('')

let sent = 0
let failed = 0

for (const u of users) {
  const email = u.email
  const firstName = u.firstName ?? ''
  if (!email) {
    console.warn(`skip — no email: ${u.userId}`)
    continue
  }
  if (DRY_RUN) {
    console.log(`[dry] would send to ${email} (${firstName})`)
    continue
  }
  try {
    await send(email, firstName)
    sent++
    console.log(`sent → ${email}`)
  } catch (err) {
    failed++
    console.error(`FAIL → ${email}: ${err.message}`)
  }
  // gentle throttle — Resend free/pro limits are well above this
  await new Promise((r) => setTimeout(r, 150))
}

console.log('')
console.log(`Done. Sent: ${sent}. Failed: ${failed}.`)
