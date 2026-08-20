import { NextResponse } from 'next/server'
import { getProfileId } from '@/lib/clerk/resolve-id'
import {
  notifyStatusChanged,
  notifyAssignmentChanged,
  notifyTicketMovedToQueue,
} from '@/lib/email/notify'
import { shouldSendStatusEmail } from '@/lib/email/status-email'
import {
  eligibleQueueRecipients,
  teamForDepartment,
} from '@/lib/tickets/queue-audience'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertTicketAccess } from '@/lib/permissions/assert-ticket-access'

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
 * Keep a quoted value short enough to read as one line in the thread, and
 * flatten newlines so a pasted multi-line subject can't break the layout.
 */
function clip(value: string, max = 120): string {
  const flat = value.replace(/\s+/g, ' ').trim()
  return flat.length > max ? flat.slice(0, max) + '...' : flat
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
  | 'title_changed'

interface NotifyBody {
  type: NotifyType
  ticketTitle: string
  createdBy: string
  // status
  oldStatus?: string
  newStatus?: string
  /**
   * Set when this status change rode along with a reply, whose email already
   * named the new status (see `statusWithReplyBlock` in the email templates).
   * We still write the inline event line — the thread must show the change —
   * but we skip the status email so the reader gets one message instead of
   * two a couple of seconds apart. A status change made on its own leaves
   * this unset and emails exactly as before.
   */
  statusEmailSentWithReply?: boolean
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

  // All events this endpoint records (status / assignment / priority /
  // category / subcategory / department / team changes) are surfaced in
  // the UI only to agents and admins — `admin` action enforces that.
  // Auto-reopen on reply doesn't route through here (it updates the
  // ticket directly from the reply route), so the tightening doesn't
  // suppress that flow.
  const { id: ticketId } = await params

  const supabase = createAdminClient()
  const { data: ticketRow } = await supabase
    .from('tickets')
    .select(
      'created_by, assigned_to, assigned_team, title, ticket_type, priority, description',
    )
    .eq('id', ticketId)
    .maybeSingle()

  if (!ticketRow) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
  }

  let body: NotifyBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // A subject change is the one event an EMPLOYEE can trigger: they may
  // rename a ticket they raised (see `canEditTicket`), and if this endpoint
  // rejected them the rename would still save but leave no trace of who did
  // it. So that one type uses the 'manage' allow-list (creator or
  // agent/admin) while everything else stays agent/admin only.
  const access = await assertTicketAccess(
    supabase,
    userId,
    ticketId,
    ticketRow,
    body.type === 'title_changed' ? 'manage' : 'admin',
  )
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
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
    if (body.type === 'title_changed') {
      const from = (body.oldValue ?? '').trim()
      // The NEW subject is read back from the ticket row, not taken from the
      // request. This endpoint writes into the message thread, and a system
      // event carries more authority than a reply — so the one field a
      // creator could otherwise put arbitrary text into is sourced from the
      // database instead. If the update didn't actually land, nothing is
      // recorded.
      const to = (ticketRow?.title ?? '').trim()
      if (!to || from === to) return null
      // Quoted, because subjects contain their own punctuation and the
      // unquoted form reads as gibberish in the thread.
      return from
        ? `changed the subject from "${clip(from)}" to "${clip(to)}"`
        : `set the subject to "${clip(to)}"`
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
  if (
    body.type === 'status_changed' &&
    body.oldStatus &&
    body.newStatus &&
    shouldSendStatusEmail({
      oldStatus: body.oldStatus,
      newStatus: body.newStatus,
      sentWithReply: body.statusEmailSentWithReply,
    })
  ) {
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

  // ── Department / queue move ───────────────────────────────────────────────
  // Handing a ticket to another department used to leave nothing but a line
  // in this ticket's own history: the department taking it over was told
  // nothing, and — for a Department change — the ticket didn't actually go
  // anywhere. It kept the old queue and the old assignee, so it never showed
  // up in the receiving team's work list.
  //
  // Now: a Department change moves the ticket into that department's queue
  // and clears the assignee so it reads as unclaimed work, and either kind of
  // move emails the receiving queue.
  if (body.type === 'department_changed' || body.type === 'team_changed') {
    const moved = await handleQueueMove({
      supabase,
      ticketId,
      ticketRow,
      body,
      movedById: userId,
    })
    return NextResponse.json({ ok: true, ...moved })
  }

  return NextResponse.json({ ok: true })
}

/**
 * Route a moved ticket to its new queue and tell that queue about it.
 *
 * Returns a small summary so the caller (and anyone reading logs) can see
 * what happened — including the cases where nothing did.
 */
async function handleQueueMove(p: {
  supabase: ReturnType<typeof createAdminClient>
  ticketId: string
  ticketRow: {
    title: string
    assigned_to: string | null
    assigned_team: string | null
    ticket_type: string | null
    priority: string | null
    description: string | null
  }
  body: NotifyBody
  movedById: string
}): Promise<{ movedToQueue?: string; notified?: number; skipped?: string }> {
  const { supabase, ticketId, ticketRow, body, movedById } = p

  const { data: teams } = await supabase.from('teams').select('id, name')

  let targetTeamId: string | null
  let toLabel: string
  let fromLabel: string
  let unassigned = false

  if (body.type === 'department_changed') {
    // Departments and queues are matched by NAME — there is no column
    // joining them. No match means we cannot route it anywhere, so leave the
    // ticket exactly where it is rather than stranding it in a queue nobody
    // watches.
    const target = teamForDepartment(body.newValue, teams)
    if (!target) {
      console.warn(
        `[notify] ${ticketId}: no queue named "${body.newValue}" — ticket left in place`,
      )
      return { skipped: 'no_matching_queue' }
    }
    targetTeamId = target.id
    toLabel = target.name
    fromLabel = body.oldValue || ticketRow.ticket_type || '—'

    if (ticketRow.assigned_team !== targetTeamId || ticketRow.assigned_to) {
      // Clear the assignee: an agent from the department that handed the
      // ticket over is not the right owner for the department receiving it.
      const { error: moveErr } = await supabase
        .from('tickets')
        .update({ assigned_team: targetTeamId, assigned_to: null })
        .eq('id', ticketId)

      if (moveErr) {
        console.error(`[notify] ${ticketId}: queue move failed:`, moveErr.message)
        return { skipped: 'move_failed' }
      }
      unassigned = true
    }
  } else {
    // A queue was picked directly. It has already been saved by the client,
    // so we only announce it — and we deliberately leave the assignee alone,
    // since choosing a queue isn't the same as giving up ownership.
    if (!body.newTeamId) return { skipped: 'no_target_queue' }
    targetTeamId = body.newTeamId
    const map = new Map((teams ?? []).map((t) => [t.id, t.name]))
    toLabel = map.get(targetTeamId) ?? '—'
    fromLabel = body.oldTeamId ? map.get(body.oldTeamId) ?? '—' : '—'
    unassigned = !ticketRow.assigned_to
  }

  const { data: members, error: membersErr } = await supabase
    .from('profiles')
    .select('id, email, role, is_out_of_office, is_active')
    .contains('team_ids', [targetTeamId])

  if (membersErr) {
    console.error(`[notify] ${ticketId}: queue members lookup failed:`, membersErr.message)
    return { movedToQueue: toLabel, skipped: 'members_lookup_failed' }
  }

  // The person doing the moving doesn't need to be told they moved it.
  const recipientIds = eligibleQueueRecipients(members, { exclude: [movedById] })

  if (recipientIds.length > 0) {
    await supabase.from('notifications').insert(
      recipientIds.map((uid) => ({
        type: 'ticket_moved' as const,
        ticket_id: ticketId,
        ticket_title: ticketRow.title,
        from_user_id: movedById,
        to_user_id: uid,
        message: `Ticket moved from ${fromLabel} to ${toLabel}`,
        read: false,
      })),
    )

    await notifyTicketMovedToQueue({
      ticketId,
      ticketTitle: ticketRow.title,
      fromLabel,
      toLabel,
      movedById,
      recipientIds,
      unassigned,
      priority: ticketRow.priority ?? undefined,
      description: ticketRow.description,
    })
  }

  return { movedToQueue: toLabel, notified: recipientIds.length }
}
