import { NextResponse } from 'next/server'
import { getProfileId } from '@/lib/clerk/resolve-id'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyNewReply, notifyUserTagged } from '@/lib/email/notify'
import type {
  TicketStatus,
  TicketPriority,
  CannedResponseAction,
} from '@/types/ticket'

// ============================================================================
// POST /api/tickets/[id]/reply — Add a reply or internal note to a ticket
// ============================================================================

interface ReplyBody {
  content: string
  isInternal: boolean
  taggedAgents?: string[]
  attachmentIds?: string[]
  cannedResponseId?: string
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // ── Authenticate ───────────────────────────────────────────────────────────
  const userId = await getProfileId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: ticketId } = await params

  // ── Parse & validate body ──────────────────────────────────────────────────
  let body: ReplyBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  if (!body.content || body.isInternal === undefined) {
    return NextResponse.json(
      { error: 'Missing required fields: content, isInternal' },
      { status: 400 },
    )
  }

  const supabase = createAdminClient()

  // ── Verify ticket exists ───────────────────────────────────────────────────
  const { data: ticket, error: ticketFetchError } = await supabase
    .from('tickets')
    .select('id, title, status, created_by, assigned_to')
    .eq('id', ticketId)
    .single()

  if (ticketFetchError || !ticket) {
    return NextResponse.json(
      { error: 'Ticket not found' },
      { status: 404 },
    )
  }

  // ── Verify caller has access to this ticket ───────────────────────────────
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  const isAgentOrAdmin = callerProfile?.role === 'agent' || callerProfile?.role === 'admin'
  const isCreator = ticket.created_by === userId
  const isAssignee = ticket.assigned_to === userId

  if (!isAgentOrAdmin && !isCreator && !isAssignee) {
    // Check if CC'd or collaborator
    const { data: ccRow } = await supabase
      .from('ticket_cc')
      .select('user_id')
      .eq('ticket_id', ticketId)
      .eq('user_id', userId)
      .maybeSingle()

    const { data: collabRow } = await supabase
      .from('ticket_collaborators')
      .select('user_id')
      .eq('ticket_id', ticketId)
      .eq('user_id', userId)
      .maybeSingle()

    if (!ccRow && !collabRow) {
      return NextResponse.json(
        { error: 'You do not have access to this ticket' },
        { status: 403 },
      )
    }
  }

  // ── Insert message ─────────────────────────────────────────────────────────
  const { data: message, error: messageError } = await supabase
    .from('messages')
    .insert({
      ticket_id: ticketId,
      author_id: userId,
      content: body.content,
      is_internal: body.isInternal,
      tagged_agents: body.taggedAgents ?? null,
    })
    .select()
    .single()

  if (messageError) {
    console.error('[reply] Failed to insert message:', messageError)
    return NextResponse.json(
      { error: 'Failed to create message' },
      { status: 500 },
    )
  }

  // ── Link attachments to the message ────────────────────────────────────────
  if (body.attachmentIds && body.attachmentIds.length > 0) {
    const { error: attachError } = await supabase
      .from('attachments')
      .update({ message_id: message.id })
      .in('id', body.attachmentIds)
      .eq('ticket_id', ticketId)

    if (attachError) {
      console.error('[reply] Failed to link attachments:', attachError)
    }
  }

  // ── Handle canned response actions ─────────────────────────────────────────
  if (body.cannedResponseId) {
    const { data: canned, error: cannedError } = await supabase
      .from('canned_responses')
      .select('*')
      .eq('id', body.cannedResponseId)
      .single()

    if (cannedError || !canned) {
      console.error('[reply] Canned response not found:', cannedError)
    } else {
      const actions = canned.actions as CannedResponseAction | null

      if (actions) {
        // Build ticket updates from canned response actions
        const ticketUpdates: Record<string, unknown> = {}
        if (actions.setStatus) {
          ticketUpdates.status = actions.setStatus as TicketStatus
        }
        if (actions.setPriority) {
          ticketUpdates.priority = actions.setPriority as TicketPriority
        }
        if (actions.setTeam) {
          ticketUpdates.assigned_team = actions.setTeam
        }

        if (Object.keys(ticketUpdates).length > 0) {
          const { error: updateError } = await supabase
            .from('tickets')
            .update(ticketUpdates)
            .eq('id', ticketId)

          if (updateError) {
            console.error('[reply] Failed to apply canned response ticket updates:', updateError)
          }
        }

        // Add internal note if specified
        if (actions.addInternalNote) {
          const { error: noteError } = await supabase
            .from('messages')
            .insert({
              ticket_id: ticketId,
              author_id: userId,
              content: actions.addInternalNote,
              is_internal: true,
            })

          if (noteError) {
            console.error('[reply] Failed to insert canned response internal note:', noteError)
          }
        }
      }

      // Increment usage_count
      const { error: usageError } = await supabase
        .from('canned_responses')
        .update({ usage_count: (canned.usage_count ?? 0) + 1 })
        .eq('id', body.cannedResponseId)

      if (usageError) {
        console.error('[reply] Failed to increment canned response usage_count:', usageError)
      }
    }
  }

  // ── Handle tagged agents ───────────────────────────────────────────────────
  if (body.taggedAgents && body.taggedAgents.length > 0) {
    // Create notifications for each tagged agent
    const notifications = body.taggedAgents.map((agentId) => ({
      type: 'tagged' as const,
      ticket_id: ticketId,
      ticket_title: ticket.title,
      from_user_id: userId,
      to_user_id: agentId,
      message: `You were tagged in ticket ${ticketId}`,
    }))

    const { error: notifError } = await supabase
      .from('notifications')
      .insert(notifications)

    if (notifError) {
      console.error('[reply] Failed to create tag notifications:', notifError)
    }

    // Add tagged agents as collaborators (upsert to avoid duplicates)
    const collaborators = body.taggedAgents.map((agentId) => ({
      ticket_id: ticketId,
      user_id: agentId,
    }))

    const { error: collabError } = await supabase
      .from('ticket_collaborators')
      .upsert(collaborators, { onConflict: 'ticket_id,user_id' })

    if (collabError) {
      console.error('[reply] Failed to add collaborators:', collabError)
    }
  }

  // ── Update ticket's updated_at ─────────────────────────────────────────────
  // The DB trigger handles updated_at, but we touch the ticket to ensure it fires.
  const { error: touchError } = await supabase
    .from('tickets')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', ticketId)

  if (touchError) {
    console.error('[reply] Failed to update ticket timestamp:', touchError)
  }

  // ── Send email notifications (must await — Vercel kills the function after response) ──
  await notifyNewReply({
    ticketId,
    ticketTitle: ticket.title,
    authorId: userId,
    content: body.content,
    isInternal: body.isInternal,
    createdBy: ticket.created_by,
    assignedTo: ticket.assigned_to,
  })

  if (body.taggedAgents && body.taggedAgents.length > 0) {
    await notifyUserTagged({
      ticketId,
      ticketTitle: ticket.title,
      taggedUserIds: body.taggedAgents,
      taggedById: userId,
    })
  }

  return NextResponse.json(message, { status: 201 })
}
