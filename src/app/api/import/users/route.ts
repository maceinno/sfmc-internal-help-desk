import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase/admin'

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
  // ── Authenticate ──────────────────────────────────────────────────────────
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
      // Insert
      const { error } = await supabase.from('profiles').insert(profileData)

      if (error) {
        errors.push(`Row ${i + 1} (${row.email}): ${error.message}`)
      } else {
        created++
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
