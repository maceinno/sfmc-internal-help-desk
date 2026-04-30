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

const PRIORITY_LABEL: Record<string, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status
}

function priorityLabel(priority: string): string {
  return PRIORITY_LABEL[priority] ?? priority
}

/**
 * POST /api/tickets/[id]/notify
 *
 * Called by the client after a successful ticket field update. Two
 * jobs:
 *   1) write an inline system-event row to the ticket's message thread
 *      ("X changed priority from Medium to High · timestamp"),
 *   2) fire email notifications for the subset of changes that warrant
 *      mail (status, assignment).
 *
 * Field-only changes that just need the inline event line — priority,
 * category, sub-category, department, team — skip the email step.
 */

type NotifyType =
  | 'status_changed'
  | 'assignment_changed'
  | 'priority_changed'
  | 'category_changed'
  | 'subcategory_changed'
  | 'department_changed'
  | 'team_changed'

interface NotifyBody {
  type: NotifyType
  ticketTitle: string
  createdBy: string
  // status
  oldStatus?: string
  newStatus?: string
  // assignment (user)
  newAssigneeId?: string
  // priority
  oldPriority?: string
  newPriority?: string
  // category / sub-category / department: stored as display strings
  oldValue?: string | null
  newValue?: string | null
  // team
  oldTeamId?: string | null
  newTeamId?: string | null
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

  // Build the human-readable system-event content for whichever event
  // type was reported. Returns null when there's nothing to record
  // (e.g. priority body shape was off, or team change but neither side
  // resolved to a known team name).
  async function buildSystemContent(): Promise<string | null> {
    if (body.type === 'status_changed' && body.oldStatus && body.newStatus) {
      return `changed status from ${statusLabel(body.oldStatus)} to ${statusLabel(body.newStatus)}`
    }
    if (body.type === 'assignment_changed' && body.newAssigneeId) {
      return `assigned this ticket`
    }
    if (body.type === 'priority_changed' && body.oldPriority && body.newPriority) {
      return `changed priority from ${priorityLabel(body.oldPriority)} to ${priorityLabel(body.newPriority)}`
    }
    if (body.type === 'category_changed') {
      const from = body.oldValue || '—'
      const to = body.newValue || '—'
      return `changed category from ${from} to ${to}`
    }
    if (body.type === 'subcategory_changed') {
      const from = body.oldValue || '—'
      const to = body.newValue || '—'
      return `changed sub-category from ${from} to ${to}`
    }
    if (body.type === 'department_changed') {
      const from = body.oldValue || '—'
      const to = body.newValue || '—'
      return `changed department from ${from} to ${to}`
    }
    if (body.type === 'team_changed') {
      const supabase = createAdminClient()
      const ids = [body.oldTeamId, body.newTeamId].filter(Boolean) as string[]
      const { data: teamRows } = ids.length
        ? await supabase.from('teams').select('id, name').in('id', ids)
        : { data: [] as { id: string; name: string }[] }
      const map = new Map((teamRows ?? []).map((t) => [t.id, t.name]))
      const from = body.oldTeamId ? map.get(body.oldTeamId) ?? '—' : '—'
      const to = body.newTeamId ? map.get(body.newTeamId) ?? '—' : '—'
      if (from === to) return null
      return `moved team from ${from} to ${to}`
    }
    return null
  }

  const systemContent = await buildSystemContent()
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

  // Email side — only status and direct user assignment fire mail.
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
