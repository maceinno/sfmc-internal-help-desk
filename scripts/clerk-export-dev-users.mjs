#!/usr/bin/env node
// Export users from a Clerk instance into the format the
// clerk/migration-tool consumes (https://github.com/clerk/migration-tool).
// Each row's `userId` is the source-instance user id, which the migration
// tool stores as `external_id` on the destination user — that's how we
// preserve every existing FK to profiles.id during the dev → prod move.
//
// Usage:
//   CLERK_SECRET_KEY=sk_test_xxx node scripts/clerk-export-dev-users.mjs > dev-users.json
// Or:
//   CLERK_SECRET_KEY=sk_test_xxx node scripts/clerk-export-dev-users.mjs --out dev-users.json
//
// Flags:
//   --out <path>   write to file instead of stdout
//   --dry-run      fetch and count but emit only a summary (no PII written)

import { writeFileSync } from 'node:fs'

const CLERK_API = 'https://api.clerk.com/v1'
const SECRET = process.env.CLERK_SECRET_KEY
if (!SECRET) {
  console.error('CLERK_SECRET_KEY env var is required')
  process.exit(1)
}

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const outFlagIdx = args.indexOf('--out')
const outPath = outFlagIdx >= 0 ? args[outFlagIdx + 1] : null

async function clerk(path) {
  const res = await fetch(`${CLERK_API}${path}`, {
    headers: { Authorization: `Bearer ${SECRET}` },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Clerk ${path} -> ${res.status}: ${body}`)
  }
  return res.json()
}

async function listAllUsers() {
  const PAGE = 500
  let offset = 0
  const all = []
  for (;;) {
    const batch = await clerk(`/users?limit=${PAGE}&offset=${offset}`)
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

function toMigrationRow(u) {
  const email = primaryEmail(u)
  if (!email) {
    throw new Error(`User ${u.id} has no email — cannot migrate without an identifier`)
  }
  return {
    userId: u.id, // becomes external_id on the destination
    email,
    firstName: u.first_name ?? undefined,
    lastName: u.last_name ?? undefined,
    publicMetadata: u.public_metadata ?? {},
    privateMetadata: u.private_metadata ?? {},
    // createdAt is supported by the migration tool to preserve original signup time.
    createdAt:
      typeof u.created_at === 'number'
        ? new Date(u.created_at).toISOString()
        : undefined,
  }
}

async function main() {
  console.error(`[export] Fetching users from Clerk (${SECRET.startsWith('sk_live_') ? 'PRODUCTION' : 'development'} instance)…`)
  const users = await listAllUsers()
  console.error(`[export] Got ${users.length} users.`)

  const rows = []
  const skipped = []
  for (const u of users) {
    try {
      rows.push(toMigrationRow(u))
    } catch (err) {
      skipped.push({ id: u.id, reason: err instanceof Error ? err.message : String(err) })
    }
  }

  console.error(`[export] Migration-ready rows: ${rows.length}. Skipped: ${skipped.length}.`)
  if (skipped.length > 0) {
    console.error('[export] Skipped users:')
    for (const s of skipped) console.error(`  - ${s.id}: ${s.reason}`)
  }

  if (dryRun) {
    console.error('[export] --dry-run set; not emitting PII.')
    console.error(JSON.stringify({ totalUsers: users.length, migrationRows: rows.length, skipped }, null, 2))
    return
  }

  const json = JSON.stringify(rows, null, 2)
  if (outPath) {
    writeFileSync(outPath, json)
    console.error(`[export] Wrote ${rows.length} rows to ${outPath}`)
  } else {
    process.stdout.write(json)
  }
}

main().catch((err) => {
  console.error('[export] FAILED:', err)
  process.exit(1)
})
