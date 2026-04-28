import { NextResponse } from 'next/server'
import { getProfileId } from '@/lib/clerk/resolve-id'
import { notifyStatusChanged, notifyAssignmentChanged } from '@/lib/email/notify'

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
