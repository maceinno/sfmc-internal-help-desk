import { NextResponse } from 'next/server'
import { getProfileId } from '@/lib/clerk/resolve-id'
import { notifyStatusChanged, notifyAssignmentChanged } from '@/lib/email/notify'
import { createAdminClient } from '@/lib/supabase/admin'

const STATUS_LABEL: Record<string, string> = {
  new: 'New',
  open: 'Open',
  pending: 'Pending',
  on_hold: 'On Hold',
  solved: 'Solved',
}

function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status
}

/**
 * POST /api/tickets/[id]/notify — Fire email notifications for field changes.
 *
 * Called by the client after a successful ticket update to send
 * status-change or assignment-change emails.
 *
 * Body: {
 *   type: 'status_changed' | 'assignment_changed'
 *   ticketTitle: string
 *   createdBy: string
 *   oldStatus?: string
 *   newStatus?: string
 *   newAssigneeId?: string
 * }
 */

interface NotifyBody {
  type: 'status_changed' | 'assignment_changed'
  ticketTitle: string
  createdBy: string
  oldStatus?: string
  newStatus?: string
  newAssigneeId?: string
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getProfileId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: ticketId } = await params

  let body: NotifyBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Insert an inline system-event row in the ticket's message thread so
  // status / assignment changes show up chronologically alongside replies.
  // Awaited so realtime subscribers see the new row before the function
  // returns, but non-fatal — failure here doesn't block the email send.
  let systemContent: string | null = null
  if (body.type === 'status_changed' && body.oldStatus && body.newStatus) {
    systemContent = `changed status from ${statusLabel(body.oldStatus)} to ${statusLabel(body.newStatus)}`
  }
  if (body.type === 'assignment_changed' && body.newAssigneeId) {
    systemContent = `assigned this ticket`
  }
  if (systemContent) {
    try {
      const supabase = createAdminClient()
      await supabase.from('messages').insert({
        ticket_id: ticketId,
        author_id: userId,
        content: systemContent,
        is_internal: false,
        is_system: true,
      })
    } catch (err) {
      console.error('[notify] system message insert failed:', err)
    }
  }

  if (body.type === 'status_changed' && body.oldStatus && body.newStatus) {
    notifyStatusChanged({
      ticketId,
      ticketTitle: body.ticketTitle,
      oldStatus: body.oldStatus,
      newStatus: body.newStatus,
      changedById: userId,
      createdBy: body.createdBy,
    })
  }

  if (body.type === 'assignment_changed' && body.newAssigneeId) {
    notifyAssignmentChanged({
      ticketId,
      ticketTitle: body.ticketTitle,
      newAssigneeId: body.newAssigneeId,
      assignedById: userId,
    })
  }

  return NextResponse.json({ ok: true })
}
