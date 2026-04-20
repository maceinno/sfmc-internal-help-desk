import { auth, clerkClient } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { notifyUserWelcome } from '@/lib/email'

const PORTAL_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://help.sfmc.com'

/**
 * POST /api/users/create
 *
 * Creates a new user in Clerk and syncs their profile to Supabase.
 * Admin-only. The user gets an email invitation from Clerk to set
 * their password on first login.
 *
 * Body: {
 *   name: string
 *   email: string
 *   role: 'employee' | 'agent' | 'admin'
 *   department?: string
 *   teamIds?: string[]
 *   branchId?: string
 *   regionId?: string
 *   hasBranchAccess?: boolean
 *   managedBranchId?: string
 *   hasRegionalAccess?: boolean
 *   managedRegionId?: string
 * }
 */

interface CreateUserBody {
  name: string
  email: string
  role: 'employee' | 'agent' | 'admin'
  department?: string
  teamIds?: string[]
  branchId?: string
  regionId?: string
  hasBranchAccess?: boolean
  managedBranchId?: string
  hasRegionalAccess?: boolean
  managedRegionId?: string
}

export async function POST(request: Request) {
  // Verify caller is admin
  const { userId: callerId } = await auth()
  if (!callerId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', callerId)
    .single()

  if (callerProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Parse body
  let body: CreateUserBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.name?.trim() || !body.email?.trim()) {
    return NextResponse.json(
      { error: 'Name and email are required' },
      { status: 400 },
    )
  }

  const validRoles = ['employee', 'agent', 'admin']
  if (!validRoles.includes(body.role)) {
    return NextResponse.json(
      { error: 'Invalid role' },
      { status: 400 },
    )
  }

  try {
    // Split name into first/last for Clerk
    const nameParts = body.name.trim().split(/\s+/)
    const firstName = nameParts[0]
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined

    // Create user in Clerk
    const client = await clerkClient()
    const clerkUser = await client.users.createUser({
      emailAddress: [body.email.trim()],
      firstName,
      lastName,
      publicMetadata: {
        role: body.role,
        hasBranchAccess: body.hasBranchAccess ?? false,
        hasRegionalAccess: body.hasRegionalAccess ?? false,
      },
      skipPasswordRequirement: true,
    })

    // Upsert profile in Supabase — the Clerk webhook (user.created) may race
    // with us and insert the base row first. Upsert on `id` enriches either way.
    const { error: profileError } = await supabase.from('profiles').upsert(
      {
        id: clerkUser.id,
        email: body.email.trim(),
        name: body.name.trim(),
        role: body.role,
        department: body.department || null,
        team_ids: body.teamIds?.length ? body.teamIds : null,
        branch_id: body.branchId || null,
        region_id: body.regionId || null,
        has_branch_access: body.hasBranchAccess ?? false,
        managed_branch_id: body.hasBranchAccess ? (body.managedBranchId || null) : null,
        has_regional_access: body.hasRegionalAccess ?? false,
        managed_region_id: body.hasRegionalAccess ? (body.managedRegionId || null) : null,
      },
      { onConflict: 'id' },
    )

    if (profileError) {
      console.error('[create-user] Failed to create Supabase profile:', profileError)
      // Try to clean up the Clerk user if Supabase insert failed
      try {
        await client.users.deleteUser(clerkUser.id)
      } catch (cleanupErr) {
        console.error('[create-user] Failed to clean up Clerk user:', cleanupErr)
      }
      return NextResponse.json(
        { error: 'Failed to create user profile' },
        { status: 500 },
      )
    }

    // Send welcome email with a Clerk sign-in link. Non-fatal on failure.
    try {
      const token = await client.signInTokens.createSignInToken({
        userId: clerkUser.id,
        expiresInSeconds: 60 * 60 * 24 * 7, // 7 days
      })
      const signInUrl = `${PORTAL_URL}/sign-in?__clerk_ticket=${token.token}`
      await notifyUserWelcome({
        email: body.email.trim(),
        name: body.name.trim(),
        role: body.role,
        signInUrl,
      })
    } catch (welcomeErr) {
      console.error(
        `[create-user] Failed to send welcome email to ${body.email}:`,
        welcomeErr,
      )
    }

    return NextResponse.json({
      id: clerkUser.id,
      email: body.email.trim(),
      name: body.name.trim(),
    }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[create-user] Error:', message)

    // Clerk-specific error messages
    if (message.includes('already exists') || message.includes('taken')) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 409 },
      )
    }

    return NextResponse.json(
      { error: message },
      { status: 500 },
    )
  }
}
