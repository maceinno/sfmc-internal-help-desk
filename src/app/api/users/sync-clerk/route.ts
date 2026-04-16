import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/users/sync-clerk
 *
 * After a profile is updated in Supabase, sync the role-related fields
 * to Clerk's publicMetadata so the middleware can enforce route access
 * without a DB call on every request.
 *
 * Body: { userId: string }
 *
 * Reads the current profile from Supabase and pushes the relevant
 * fields into Clerk publicMetadata.
 */
export async function POST(request: Request) {
  // Verify the caller is an admin
  const { userId: callerId } = await auth()
  if (!callerId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServerSupabaseClient()
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', callerId)
    .single()

  if (callerProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Parse request
  const { userId } = (await request.json()) as { userId: string }
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  // Read the profile from Supabase (source of truth)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('name, role, has_branch_access, has_regional_access')
    .eq('id', userId)
    .single()

  if (profileError || !profile) {
    return NextResponse.json(
      { error: 'Profile not found' },
      { status: 404 },
    )
  }

  // Sync to Clerk
  const client = await clerkClient()

  // Sync name
  const nameParts = profile.name.trim().split(/\s+/)
  await client.users.updateUser(userId, {
    firstName: nameParts[0],
    lastName: nameParts.length > 1 ? nameParts.slice(1).join(' ') : '',
  })

  // Sync publicMetadata
  await client.users.updateUserMetadata(userId, {
    publicMetadata: {
      role: profile.role,
      hasBranchAccess: profile.has_branch_access,
      hasRegionalAccess: profile.has_regional_access,
    },
  })

  return NextResponse.json({ ok: true })
}
