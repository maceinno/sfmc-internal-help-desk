import { NextResponse } from 'next/server'
import { getProfileId } from '@/lib/clerk/resolve-id'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyCcAdded } from '@/lib/email/notify'

// POST /api/tickets/[id]/cc — add a CC user and email them.
// Body: { userId: string }
//
// Wraps what used to be a direct ticket_cc insert from the client so we
// can send the CC'd-you notification server-side. The DELETE counterpart
// is intentionally not here yet — removing a CC doesn't trigger any
// outbound email, so the client can keep doing that direct.

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const callerId = await getProfileId()
  if (!callerId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: ticketId } = await params

  let body: { userId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const userId = body.userId
  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Verify the ticket exists + caller has access. We trust RLS for the
  // browser-driven case; this server route uses admin client so we add
  // the access check ourselves.
  const { data: ticket, error: ticketErr } = await supabase
    .from('tickets')
    .select('id, title, created_by, assigned_to')
    .eq('id', ticketId)
    .single()

  if (ticketErr || !ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
  }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', callerId)
    .single()

  const isAgentOrAdmin =
    callerProfile?.role === 'agent' || callerProfile?.role === 'admin'
  const isCreator = ticket.created_by === callerId

  if (!isAgentOrAdmin && !isCreator) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Idempotent insert: if the user is already CC'd, treat as success but
  // don't re-send the email.
  const { data: existing } = await supabase
    .from('ticket_cc')
    .select('user_id')
    .eq('ticket_id', ticketId)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ ok: true, alreadyCc: true })
  }

  const { error: insertErr } = await supabase
    .from('ticket_cc')
    .insert({ ticket_id: ticketId, user_id: userId })

  if (insertErr) {
    console.error('[cc-add] insert failed:', insertErr)
    return NextResponse.json({ error: 'Failed to add CC' }, { status: 500 })
  }

  // Email the newly-CC'd user. Awaited so Vercel doesn't kill the
  // function before it sends.
  await notifyCcAdded({
    ticketId,
    ticketTitle: ticket.title,
    addedUserId: userId,
    addedById: callerId,
  })

  return NextResponse.json({ ok: true })
}
