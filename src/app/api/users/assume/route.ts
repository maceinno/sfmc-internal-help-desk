import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'assumed-user-id'

/**
 * POST /api/users/assume — Start assuming a user (admin only)
 * Body: { userId: string }
 */
export async function POST(request: Request) {
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
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
  }

  const { userId } = (await request.json()) as { userId: string }
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  // Verify target user exists
  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('id, name, role')
    .eq('id', userId)
    .single()

  if (!targetProfile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, userId, {
    httpOnly: false, // Needs to be readable by client JS
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 4, // 4 hours
  })

  return NextResponse.json({
    assumedUser: {
      id: targetProfile.id,
      name: targetProfile.name,
      role: targetProfile.role,
    },
  })
}

/**
 * DELETE /api/users/assume — Stop assuming a user
 */
export async function DELETE() {
  const { userId: callerId } = await auth()
  if (!callerId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)

  return NextResponse.json({ ok: true })
}
