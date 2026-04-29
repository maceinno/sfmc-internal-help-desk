import 'server-only'

import { resend, EMAIL_FROM, ticketReplyTo } from './resend'
import * as templates from './templates'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Resolve user IDs to emails + roles. Returns a map of userId -> { email, name, role }.
 */
async function resolveUsers(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, { email: string; name: string; role: string }>()

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name, role')
    .in('id', userIds)

  if (error) {
    console.error('[email] Failed to resolve users:', error)
    return new Map<string, { email: string; name: string; role: string }>()
  }

  const map = new Map<string, { email: string; name: string; role: string }>()
  for (const u of data ?? []) {
    map.set(u.id, { email: u.email, name: u.name, role: u.role })
  }
  return map
}

async function send(to: string, template: { subject: string; html: string }, ticketId?: string) {
  try {
    console.log(`[email] Sending to ${to} from ${EMAIL_FROM} — subject: ${template.subject}`)
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      replyTo: ticketId ? ticketReplyTo(ticketId) : undefined,
      subject: template.subject,
      html: template.html,
    })
    if (error) {
      console.error(`[email] Resend error for ${to}:`, JSON.stringify(error))
    } else {
      console.log(`[email] Sent successfully to ${to} — id: ${data?.id}`)
    }
  } catch (err) {
    console.error(`[email] Failed to send to ${to}:`, err)
  }
}

// ── Public notification functions ────────────────────────────────

/**
 * Ticket created — notify creator, assigned agent (if any), and members
 * of the assigned team queue when no specific agent is assigned. Tickets
 * with neither assigned_to nor assigned_team only notify the creator.
 *
 * Team-queue notifications skip OOO members and the creator themselves
 * (an agent who created a ticket on behalf of someone in their own team
 * shouldn't get their own notification).
 */
export async function notifyTicketCreated(ticket: {
  id: string
  title: string
  category: string
  priority: string
  created_by: string
  assigned_to: string | null
  assigned_team?: string | null
  cc?: string[]
}) {
  const ccUserIds = (ticket.cc ?? []).filter((id) => id !== ticket.created_by)
  const userIds = [ticket.created_by, ...ccUserIds]
  if (ticket.assigned_to) userIds.push(ticket.assigned_to)
  const users = await resolveUsers(userIds)

  const creator = users.get(ticket.created_by)
  if (creator) {
    await send(creator.email, templates.ticketCreatedCreator({
      ticketId: ticket.id,
      title: ticket.title,
      category: ticket.category,
      priority: ticket.priority,
    }), ticket.id)
  }

  // Notify each CC'd user that they've been added to a brand-new ticket.
  // Reuses the same ccAdded template path the runtime-add flow uses;
  // the isAtCreation flag tweaks the lead copy.
  for (const ccId of ccUserIds) {
    const ccUser = users.get(ccId)
    if (!ccUser) continue
    if (ccUser.email === creator?.email) continue
    await send(
      ccUser.email,
      templates.ccAdded({
        ticketId: ticket.id,
        title: ticket.title,
        addedByName: creator?.name ?? 'Someone',
        isAtCreation: true,
      }),
      ticket.id,
    )
  }

  // Specific agent assignment: notify just that agent.
  if (ticket.assigned_to) {
    const agent = users.get(ticket.assigned_to)
    if (agent && agent.email !== creator?.email) {
      await send(agent.email, templates.ticketCreatedAgent({
        ticketId: ticket.id,
        title: ticket.title,
        category: ticket.category,
        priority: ticket.priority,
        creatorName: creator?.name ?? 'Unknown',
      }), ticket.id)
    }
    return
  }

  // No specific agent → fan out to the team queue if one is set.
  if (!ticket.assigned_team) return

  try {
    const supabase = createAdminClient()

    const { data: team } = await supabase
      .from('teams')
      .select('id, name')
      .eq('id', ticket.assigned_team)
      .single()

    if (!team) {
      console.warn(`[email] notifyTicketCreated: team ${ticket.assigned_team} not found`)
      return
    }

    const { data: members, error: membersErr } = await supabase
      .from('profiles')
      .select('id, email, name, role, is_out_of_office')
      .contains('team_ids', [ticket.assigned_team])

    if (membersErr) {
      console.error('[email] notifyTicketCreated: failed to load team members:', membersErr)
      return
    }

    const recipients = (members ?? []).filter(
      (m) =>
        (m.role === 'agent' || m.role === 'admin') &&
        !m.is_out_of_office &&
        m.id !== ticket.created_by &&
        m.email,
    )

    console.log(
      `[email] notifyTicketCreated: fanning out to ${recipients.length} member(s) of team ${team.name}`,
    )

    for (const member of recipients) {
      await send(
        member.email,
        templates.ticketCreatedTeam({
          ticketId: ticket.id,
          title: ticket.title,
          category: ticket.category,
          priority: ticket.priority,
          creatorName: creator?.name ?? 'Unknown',
          teamName: team.name,
        }),
        ticket.id,
      )
    }
  } catch (err) {
    console.error('[email] notifyTicketCreated team fan-out crashed:', err)
  }
}

/**
 * New reply — notify all parties on the ticket with the full conversation.
 * Skips the author of the reply.
 */
export async function notifyNewReply(p: {
  ticketId: string
  ticketTitle: string
  authorId: string
  content: string
  isInternal: boolean
  createdBy: string
  assignedTo: string | null
}) {
  try {
    console.log(`[email] notifyNewReply called for ticket ${p.ticketId} by ${p.authorId}`)

    const supabase = createAdminClient()

    // Fetch conversation history + ticket description
    const { data: ticket } = await supabase
      .from('tickets')
      .select('description')
      .eq('id', p.ticketId)
      .single()

    const { data: messages } = await supabase
      .from('messages')
      .select('author_id, content, is_internal, created_at')
      .eq('ticket_id', p.ticketId)
      .order('created_at', { ascending: true })

    // Get CC'd user IDs
    const { data: ccRows } = await supabase
      .from('ticket_cc')
      .select('user_id')
      .eq('ticket_id', p.ticketId)

    const ccUserIds = (ccRows ?? []).map((r) => r.user_id)

    // Collect all recipients (deduplicated, excluding author)
    const recipientIds = new Set<string>()

    if (!p.isInternal) {
      recipientIds.add(p.createdBy)
      if (p.assignedTo) recipientIds.add(p.assignedTo)
      ccUserIds.forEach((id) => recipientIds.add(id))
    } else {
      if (p.assignedTo) recipientIds.add(p.assignedTo)

      const { data: collabRows } = await supabase
        .from('ticket_collaborators')
        .select('user_id')
        .eq('ticket_id', p.ticketId)

      for (const r of collabRows ?? []) {
        recipientIds.add(r.user_id)
      }
    }

    // All parties get every reply — including the author (for their records)
    recipientIds.add(p.authorId)

    if (recipientIds.size === 0) {
      console.log(`[email] notifyNewReply: no recipients after filtering`)
      return
    }

    // Resolve all user IDs we need (recipients + message authors)
    const allAuthorIds = new Set<string>([p.authorId, p.createdBy])
    for (const msg of messages ?? []) {
      allAuthorIds.add(msg.author_id)
    }
    for (const id of recipientIds) {
      allAuthorIds.add(id)
    }

    const allUsers = await resolveUsers(Array.from(allAuthorIds))
    const authorName = allUsers.get(p.authorId)?.name ?? 'Someone'

    console.log(`[email] notifyNewReply: sending to ${recipientIds.size} recipients`)

    // Build conversation thread
    const conversation: templates.ConversationMessage[] = (messages ?? [])
      .filter((msg) => msg.content !== p.content)
      .map((msg) => ({
        authorName: allUsers.get(msg.author_id)?.name ?? 'Unknown',
        content: msg.content,
        isInternal: msg.is_internal,
        createdAt: msg.created_at,
      }))

    const publicConversation = conversation.filter((msg) => !msg.isInternal)

    for (const userId of recipientIds) {
      const user = allUsers.get(userId)
      if (!user) {
        console.log(`[email] notifyNewReply: skipping ${userId} — user not found`)
        continue
      }

      const isAgentOrAdmin = user.role === 'agent' || user.role === 'admin'
      const visibleConversation = isAgentOrAdmin ? conversation : publicConversation

      const templateParams = {
        ticketId: p.ticketId,
        title: p.ticketTitle,
        authorName,
        content: p.content,
        isInternal: p.isInternal,
        description: ticket?.description,
        conversation: visibleConversation,
      }

      if (ccUserIds.includes(userId) && userId !== p.createdBy && userId !== p.assignedTo) {
        await send(user.email, templates.ccNotification(templateParams), p.ticketId)
      } else {
        await send(user.email, templates.newReply(templateParams), p.ticketId)
      }
    }
  } catch (err) {
    console.error('[email] notifyNewReply crashed:', err)
  }
}

/**
 * Status changed — notify the ticket creator and any CC'd users so the
 * full audience following the ticket sees the resolution / move.
 */
export async function notifyStatusChanged(p: {
  ticketId: string
  ticketTitle: string
  oldStatus: string
  newStatus: string
  changedById: string
  createdBy: string
}) {
  try {
    const supabase = createAdminClient()
    const { data: ccRows } = await supabase
      .from('ticket_cc')
      .select('user_id')
      .eq('ticket_id', p.ticketId)

    const ccUserIds = (ccRows ?? [])
      .map((r) => r.user_id as string)
      .filter((id) => id !== p.createdBy && id !== p.changedById)

    const recipientIds = new Set<string>(ccUserIds)
    // Skip notifying the creator if they made the change themselves.
    if (p.changedById !== p.createdBy) recipientIds.add(p.createdBy)

    if (recipientIds.size === 0) return

    const users = await resolveUsers([
      ...recipientIds,
      p.changedById,
    ])
    const changer = users.get(p.changedById)

    for (const userId of recipientIds) {
      const user = users.get(userId)
      if (!user) continue
      await send(
        user.email,
        templates.statusChanged({
          ticketId: p.ticketId,
          title: p.ticketTitle,
          oldStatus: p.oldStatus,
          newStatus: p.newStatus,
          changedByName: changer?.name ?? 'An agent',
        }),
        p.ticketId,
      )
    }
  } catch (err) {
    console.error('[email] notifyStatusChanged crashed:', err)
  }
}

/**
 * Runtime CC-add — emit a single "you've been CC'd" notification to a
 * user who was just added to an existing ticket.
 */
export async function notifyCcAdded(p: {
  ticketId: string
  ticketTitle: string
  addedUserId: string
  addedById: string
}) {
  if (p.addedUserId === p.addedById) return
  try {
    const users = await resolveUsers([p.addedUserId, p.addedById])
    const target = users.get(p.addedUserId)
    const adder = users.get(p.addedById)
    if (!target) return
    await send(
      target.email,
      templates.ccAdded({
        ticketId: p.ticketId,
        title: p.ticketTitle,
        addedByName: adder?.name ?? 'Someone',
        isAtCreation: false,
      }),
      p.ticketId,
    )
  } catch (err) {
    console.error('[email] notifyCcAdded crashed:', err)
  }
}

/**
 * Assignment changed — notify the newly assigned agent.
 */
export async function notifyAssignmentChanged(p: {
  ticketId: string
  ticketTitle: string
  newAssigneeId: string
  assignedById: string
}) {
  // Don't notify if assigning to yourself
  if (p.newAssigneeId === p.assignedById) return

  const users = await resolveUsers([p.newAssigneeId, p.assignedById])
  const assignee = users.get(p.newAssigneeId)
  const assigner = users.get(p.assignedById)

  if (assignee) {
    await send(assignee.email, templates.assignmentChanged({
      ticketId: p.ticketId,
      title: p.ticketTitle,
      assigneeName: assignee.name,
      assignedByName: assigner?.name ?? 'An admin',
    }), p.ticketId)
  }
}

/**
 * User tagged/mentioned — notify tagged users.
 */
export async function notifyUserTagged(p: {
  ticketId: string
  ticketTitle: string
  taggedUserIds: string[]
  taggedById: string
}) {
  const allIds = [...p.taggedUserIds, p.taggedById]
  const users = await resolveUsers(allIds)
  const tagger = users.get(p.taggedById)

  for (const userId of p.taggedUserIds) {
    if (userId === p.taggedById) continue
    const user = users.get(userId)
    if (user) {
      await send(user.email, templates.userTagged({
        ticketId: p.ticketId,
        title: p.ticketTitle,
        taggedByName: tagger?.name ?? 'Someone',
      }), p.ticketId)
    }
  }
}

/**
 * Welcome email for a newly provisioned user (e.g. from bulk import).
 * Sends a Clerk sign-in link so they can set a password on first login.
 */
export async function notifyUserWelcome(p: {
  email: string
  name: string
  role: string
  signInUrl: string
}) {
  await send(p.email, templates.welcomeUser({
    name: p.name,
    role: p.role,
    signInUrl: p.signInUrl,
  }))
}

/**
 * SLA alert — notify the assigned agent.
 */
export async function notifySlaAlert(p: {
  ticketId: string
  ticketTitle: string
  assignedTo: string | null
  status: 'at_risk' | 'breached'
  timeInfo: string
}) {
  if (!p.assignedTo) return

  const users = await resolveUsers([p.assignedTo])
  const agent = users.get(p.assignedTo)

  if (agent) {
    await send(agent.email, templates.slaAlert({
      ticketId: p.ticketId,
      title: p.ticketTitle,
      status: p.status,
      timeInfo: p.timeInfo,
    }), p.ticketId)
  }
}
