import { auth, clerkClient } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveClerkId } from '@/lib/clerk/resolve-id'
import { NextResponse } from 'next/server'

/**
 * PATCH /api/users/profile — Update the current user's own profile.
 *
 * Users can update: name, department, avatar_url
 * Users CANNOT update: role, email (locked down)
 *
 * Body: { name?: string, department?: string, avatarUrl?: string }
 */
export async function PATCH(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { name?: string; department?: string; avatarUrl?: string; timezone?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Build update payload — only allowed fields
  const payload: Record<string, unknown> = {}
  if (body.name?.trim()) payload.name = body.name.trim()
  if (body.department !== undefined) payload.department = body.department || null
  if (body.avatarUrl !== undefined) payload.avatar_url = body.avatarUrl || null
  if (body.timezone) payload.timezone = body.timezone

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', userId)

  if (error) {
    console.error('[profile] Failed to update:', error)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }

  // Sync name to Clerk if changed
  if (payload.name) {
    try {
      const nameParts = (payload.name as string).split(/\s+/)
      const client = await clerkClient()
      const clerkId = await resolveClerkId(client, userId)
      await client.users.updateUser(clerkId, {
        firstName: nameParts[0],
        lastName: nameParts.length > 1 ? nameParts.slice(1).join(' ') : '',
      })
    } catch (err) {
      console.error('[profile] Failed to sync name to Clerk:', err)
    }
  }

  return NextResponse.json({ ok: true })
}

/**
 * POST /api/users/profile/avatar — Upload avatar image
 * Handled via multipart form data
 */
