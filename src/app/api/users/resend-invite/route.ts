import { clerkClient } from '@clerk/nextjs/server'
import { getProfileId, resolveClerkId } from '@/lib/clerk/resolve-id'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyUserWelcome } from '@/lib/email'
import { NextResponse } from 'next/server'

const PORTAL_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://help.sfmc.com'

/**
 * POST /api/users/resend-invite
 *
 * Admin-only. Re-mints a Clerk sign-in token and re-sends the welcome/invite
 * email for an existing user (same flow as user creation).
 *
 * Body: { email: string }
 *
 * NOTE: if the address is on Resend's suppression list this send will still
 * be dropped silently — clear the suppression in the Resend dashboard first,
 * then resend.
 */
export async function POST(request: Request) {
  const callerId = await getProfileId()
  if (!callerId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data: caller } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', callerId)
    .single()

  if (caller?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { email?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  if (!email) {
    return NextResponse.json({ error: 'email is required.' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, role')
    .ilike('email', email)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json(
      { error: 'No user found with that email.' },
      { status: 404 },
    )
  }

  try {
    const client = await clerkClient()
    const clerkId = await resolveClerkId(client, profile.id)
    const token = await client.signInTokens.createSignInToken({
      userId: clerkId,
      expiresInSeconds: 60 * 60 * 24 * 7, // 7 days
    })
    const signInUrl = `${PORTAL_URL}/sign-in?__clerk_ticket=${token.token}`
    await notifyUserWelcome({
      email,
      name: profile.name,
      role: profile.role,
      signInUrl,
    })
  } catch (err) {
    console.error(`[resend-invite] Failed to resend invite to ${email}:`, err)
    return NextResponse.json(
      { error: 'Failed to resend the invite.' },
      { status: 502 },
    )
  }

  return NextResponse.json({ ok: true })
}
