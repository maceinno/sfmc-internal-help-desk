import { NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyUserWelcome } from '@/lib/email'

const PORTAL_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://help.sfmc.com'

// ============================================================================
// POST /api/import/users — Bulk upsert user profiles
// ============================================================================

interface ImportUserRow {
  name: string
  email: string
  role: 'employee' | 'agent' | 'admin'
  department?: string
  team?: string
  branch?: string
  region?: string
}

export async function POST(request: Request) {
  // ── Authenticate + authorize admin ────────────────────────────────────────
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAuth = createAdminClient()
  const { data: callerProfile } = await supabaseAuth
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (callerProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { users: ImportUserRow[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.users || !Array.isArray(body.users) || body.users.length === 0) {
    return NextResponse.json(
      { error: 'Request must contain a non-empty "users" array' },
      { status: 400 },
    )
  }

  const supabase = createAdminClient()
  const clerk = await clerkClient()

  // ── Resolve team, branch, region names to IDs ─────────────────────────────
  const [
    { data: teamsData },
    { data: branchesData },
    { data: regionsData },
  ] = await Promise.all([
    supabase.from('teams').select('id, name'),
    supabase.from('branches').select('id, name'),
    supabase.from('regions').select('id, name'),
  ])

  const teamMap = new Map(
    (teamsData ?? []).map((t) => [t.name.toLowerCase(), t.id]),
  )
  const branchMap = new Map(
    (branchesData ?? []).map((b) => [b.name.toLowerCase(), b.id]),
  )
  const regionMap = new Map(
    (regionsData ?? []).map((r) => [r.name.toLowerCase(), r.id]),
  )

  // ── Process each user ─────────────────────────────────────────────────────
  let created = 0
  let updated = 0
  const errors: string[] = []

  for (let i = 0; i < body.users.length; i++) {
    const row = body.users[i]

    if (!row.name || !row.email) {
      errors.push(`Row ${i + 1}: Missing required name or email`)
      continue
    }

    const teamId = row.team ? teamMap.get(row.team.toLowerCase()) : undefined
    const branchId = row.branch
      ? branchMap.get(row.branch.toLowerCase())
      : undefined
    const regionId = row.region
      ? regionMap.get(row.region.toLowerCase())
      : undefined

    // Check if user already exists by email
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', row.email.toLowerCase())
      .maybeSingle()

    const profileData: Record<string, unknown> = {
      name: row.name,
      email: row.email.toLowerCase(),
      role: row.role || 'employee',
      department: row.department || null,
      branch_id: branchId || null,
      region_id: regionId || null,
    }

    if (teamId) {
      // For new users, set team_ids as array; for existing users, append
      if (existing) {
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('team_ids')
          .eq('id', existing.id)
          .single()

        const existingTeamIds: string[] = existingProfile?.team_ids ?? []
        if (!existingTeamIds.includes(teamId)) {
          profileData.team_ids = [...existingTeamIds, teamId]
        } else {
          profileData.team_ids = existingTeamIds
        }
      } else {
        profileData.team_ids = [teamId]
      }
    }

    if (existing) {
      // Update
      const { error } = await supabase
        .from('profiles')
        .update(profileData)
        .eq('id', existing.id)

      if (error) {
        errors.push(`Row ${i + 1} (${row.email}): ${error.message}`)
      } else {
        updated++
      }
    } else {
      // Create Clerk user first — profiles.id is the Clerk user ID.
      const nameParts = row.name.trim().split(/\s+/)
      const firstName = nameParts[0]
      const lastName =
        nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined

      let clerkUserId: string
      let createdInClerk = false
      try {
        const clerkUser = await clerk.users.createUser({
          emailAddress: [row.email.trim()],
          firstName,
          lastName,
          publicMetadata: {
            role: row.role || 'employee',
            hasBranchAccess: false,
            hasRegionalAccess: false,
          },
          skipPasswordRequirement: true,
        })
        clerkUserId = clerkUser.id
        createdInClerk = true
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'

        // Orphan case: Clerk account exists but no profile row. Reuse the Clerk id.
        if (/already exists|taken/i.test(message)) {
          try {
            const existingClerk = await clerk.users.getUserList({
              emailAddress: [row.email.trim()],
            })
            const hit = existingClerk.data[0]
            if (!hit) throw new Error('Clerk reported duplicate but getUserList returned none')
            clerkUserId = hit.id
          } catch (lookupErr) {
            const lookupMsg =
              lookupErr instanceof Error ? lookupErr.message : 'Unknown error'
            errors.push(
              `Row ${i + 1} (${row.email}): Clerk lookup failed — ${lookupMsg}`,
            )
            continue
          }
        } else {
          errors.push(`Row ${i + 1} (${row.email}): Clerk create failed — ${message}`)
          continue
        }
      }

      // Upsert on id — webhook may race with us on user.created insert.
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: clerkUserId, ...profileData }, { onConflict: 'id' })

      if (error) {
        // Supabase insert failed — only roll back the Clerk user if we just
        // created it (don't delete pre-existing orphan accounts).
        if (createdInClerk) {
          try {
            await clerk.users.deleteUser(clerkUserId)
          } catch (cleanupErr) {
            console.error(
              `[import-users] Failed to clean up Clerk user ${clerkUserId}:`,
              cleanupErr,
            )
          }
        }
        errors.push(`Row ${i + 1} (${row.email}): ${error.message}`)
        continue
      }

      created++

      // Send welcome email with a Clerk sign-in link. Non-fatal on failure.
      try {
        const token = await clerk.signInTokens.createSignInToken({
          userId: clerkUserId,
          expiresInSeconds: 60 * 60 * 24 * 7, // 7 days
        })
        const signInUrl = `${PORTAL_URL}/sign-in?__clerk_ticket=${token.token}`
        await notifyUserWelcome({
          email: row.email.trim(),
          name: row.name,
          role: row.role || 'employee',
          signInUrl,
        })
      } catch (welcomeErr) {
        console.error(
          `[import-users] Failed to send welcome email to ${row.email}:`,
          welcomeErr,
        )
      }
    }
  }

  return NextResponse.json({
    created,
    updated,
    errors,
    total: body.users.length,
  })
}
