import { NextResponse } from 'next/server'
import { getProfileId } from '@/lib/clerk/resolve-id'
import { createAdminClient } from '@/lib/supabase/admin'

// ============================================================================
// POST /api/tickets/[id]/merge — Merge this ticket into another
// ============================================================================

interface MergeBody {
  targetTicketId: string
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // ── Authenticate & authorize ───────────────────────────────────────────────
  const userId = await getProfileId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: sourceTicketId } = await params

  const supabase = createAdminClient()

  // Verify the user is an agent or admin
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (profileError || !profile) {
    return NextResponse.json(
      { error: 'User profile not found' },
      { status: 403 },
    )
  }

  if (profile.role !== 'agent' && profile.role !== 'admin') {
    return NextResponse.json(
      { error: 'Only agents and admins can merge tickets' },
      { status: 403 },
    )
  }

  // ── Parse & validate body ──────────────────────────────────────────────────
  let body: MergeBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  if (!body.targetTicketId) {
    return NextResponse.json(
      { error: 'Missing required field: targetTicketId' },
      { status: 400 },
    )
  }

  if (body.targetTicketId === sourceTicketId) {
    return NextResponse.json(
      { error: 'Cannot merge a ticket into itself' },
      { status: 400 },
    )
  }

  // ── Verify both tickets exist ──────────────────────────────────────────────
  const { data: sourceTicket, error: sourceError } = await supabase
    .from('tickets')
    .select('id, title, status')
    .eq('id', sourceTicketId)
    .single()

  if (sourceError || !sourceTicket) {
    return NextResponse.json(
      { error: 'Source ticket not found' },
      { status: 404 },
    )
  }

  const { data: targetTicket, error: targetError } = await supabase
    .from('tickets')
    .select('id, title')
    .eq('id', body.targetTicketId)
    .single()

  if (targetError || !targetTicket) {
    return NextResponse.json(
      { error: 'Target ticket not found' },
      { status: 404 },
    )
  }

  // ── Update source ticket: mark as merged and solved ────────────────────────
  const { error: updateError } = await supabase
    .from('tickets')
    .update({
      merged_into_id: body.targetTicketId,
      status: 'solved',
    })
    .eq('id', sourceTicketId)

  if (updateError) {
    console.error('[merge] Failed to update source ticket:', updateError)
    return NextResponse.json(
      { error: 'Failed to update source ticket' },
      { status: 500 },
    )
  }

  // ── Insert record into ticket_merged table ─────────────────────────────────
  const { error: mergeRecordError } = await supabase
    .from('ticket_merged')
    .insert({
      parent_ticket_id: body.targetTicketId,
      merged_ticket_id: sourceTicketId,
    })

  if (mergeRecordError) {
    console.error('[merge] Failed to insert merge record:', mergeRecordError)
    return NextResponse.json(
      { error: 'Failed to record merge' },
      { status: 500 },
    )
  }

  // ── Add system message to source ticket noting the merge ───────────────────
  const { error: sourceNoteError } = await supabase
    .from('messages')
    .insert({
      ticket_id: sourceTicketId,
      author_id: userId,
      content: `This ticket has been merged into ${body.targetTicketId} (${targetTicket.title}).`,
      is_internal: true,
    })

  if (sourceNoteError) {
    console.error('[merge] Failed to add source merge note:', sourceNoteError)
  }

  // ── Add internal note to target ticket about the merge ─────────────────────
  const { error: targetNoteError } = await supabase
    .from('messages')
    .insert({
      ticket_id: body.targetTicketId,
      author_id: userId,
      content: `Ticket ${sourceTicketId} (${sourceTicket.title}) has been merged into this ticket.`,
      is_internal: true,
    })

  if (targetNoteError) {
    console.error('[merge] Failed to add target merge note:', targetNoteError)
  }

  // ── Copy messages from source to target ────────────────────────────────────
  const { data: sourceMessages, error: msgFetchError } = await supabase
    .from('messages')
    .select('*')
    .eq('ticket_id', sourceTicketId)
    .neq('content', `This ticket has been merged into ${body.targetTicketId} (${targetTicket.title}).`)

  if (msgFetchError) {
    console.error('[merge] Failed to fetch source messages:', msgFetchError)
  } else if (sourceMessages && sourceMessages.length > 0) {
    // Copy original (non-system) messages to target, prefixed with origin info
    const copiedMessages = sourceMessages.map((msg) => ({
      ticket_id: body.targetTicketId,
      author_id: msg.author_id,
      content: `[Merged from ${sourceTicketId}] ${msg.content}`,
      is_internal: msg.is_internal,
      tagged_agents: msg.tagged_agents,
    }))

    const { error: copyError } = await supabase
      .from('messages')
      .insert(copiedMessages)

    if (copyError) {
      console.error('[merge] Failed to copy messages to target:', copyError)
    }
  }

  // ── Touch the target ticket's updated_at ───────────────────────────────────
  const { error: touchError } = await supabase
    .from('tickets')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', body.targetTicketId)

  if (touchError) {
    console.error('[merge] Failed to touch target ticket:', touchError)
  }

  // ── Return the updated source ticket ───────────────────────────────────────
  const { data: updatedTicket, error: fetchUpdatedError } = await supabase
    .from('tickets')
    .select('*')
    .eq('id', sourceTicketId)
    .single()

  if (fetchUpdatedError) {
    console.error('[merge] Failed to fetch updated ticket:', fetchUpdatedError)
    return NextResponse.json(
      { message: 'Tickets merged successfully' },
      { status: 200 },
    )
  }

  return NextResponse.json(updatedTicket, { status: 200 })
}
