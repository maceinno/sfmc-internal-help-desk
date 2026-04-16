import 'server-only'

import { resend, EMAIL_FROM } from './resend'
import * as templates from './templates'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Resolve user IDs to emails. Returns a map of userId -> { email, name }.
 */
async function resolveUsers(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, { email: string; name: string }>()

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, email, name')
    .in('id', userIds)

  const map = new Map<string, { email: string; name: string }>()
  for (const u of data ?? []) {
    map.set(u.id, { email: u.email, name: u.name })
  }
  return map
}

async function send(to: string, template: { subject: string; html: string }) {
  try {
    console.log(`[email] Sending to ${to} from ${EMAIL_FROM} — subject: ${template.subject}`)
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to,
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
 * Ticket created — notify creator + assigned agent (if any).
 */
export async function notifyTicketCreated(ticket: {
  id: string
  title: string
  category: string
  priority: string
  created_by: string
  assigned_to: string | null
}) {
  const userIds = [ticket.created_by]
  if (ticket.assigned_to) userIds.push(ticket.assigned_to)
  const users = await resolveUsers(userIds)

  const creator = users.get(ticket.created_by)
  if (creator) {
    send(creator.email, templates.ticketCreatedCreator({
      ticketId: ticket.id,
      title: ticket.title,
      category: ticket.category,
      priority: ticket.priority,
    }))
  }

  if (ticket.assigned_to) {
    const agent = users.get(ticket.assigned_to)
    if (agent && agent.email !== creator?.email) {
      send(agent.email, templates.ticketCreatedAgent({
        ticketId: ticket.id,
        title: ticket.title,
        category: ticket.category,
        priority: ticket.priority,
        creatorName: creator?.name ?? 'Unknown',
      }))
    }
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

  // Resolve all author IDs from the conversation
  const allAuthorIds = new Set<string>([p.authorId, p.createdBy])
  for (const msg of messages ?? []) {
    allAuthorIds.add(msg.author_id)
  }
  const allUsers = await resolveUsers(Array.from(allAuthorIds))

  // Build conversation thread (exclude the new message — it's shown separately)
  const conversation: templates.ConversationMessage[] = (messages ?? [])
    .filter((msg) => msg.content !== p.content) // Skip the new message
    .map((msg) => ({
      authorName: allUsers.get(msg.author_id)?.name ?? 'Unknown',
      content: msg.content,
      isInternal: msg.is_internal,
      createdAt: msg.created_at,
    }))

  // Get CC'd user IDs
  const { data: ccRows } = await supabase
    .from('ticket_cc')
    .select('user_id')
    .eq('ticket_id', p.ticketId)

  const ccUserIds = (ccRows ?? []).map((r) => r.user_id)

  // Collect all recipients (deduplicated, excluding author)
  const recipientIds = new Set<string>()

  if (!p.isInternal) {
    // Public reply: notify creator, assignee, CC'd users
    recipientIds.add(p.createdBy)
    if (p.assignedTo) recipientIds.add(p.assignedTo)
    ccUserIds.forEach((id) => recipientIds.add(id))
  } else {
    // Internal note: only notify assignee and agents/admins who are CC'd or collaborators
    if (p.assignedTo) recipientIds.add(p.assignedTo)

    const { data: collabRows } = await supabase
      .from('ticket_collaborators')
      .select('user_id')
      .eq('ticket_id', p.ticketId)

    for (const r of collabRows ?? []) {
      recipientIds.add(r.user_id)
    }
  }

  // Remove the author
  recipientIds.delete(p.authorId)

  if (recipientIds.size === 0) return

  const users = await resolveUsers(Array.from(recipientIds))
  const authorName = allUsers.get(p.authorId)?.name ?? 'Someone'

  // Filter conversation — employees should not see internal notes
  const publicConversation = conversation.filter((msg) => !msg.isInternal)

  for (const [userId, user] of users) {
    // Determine if this recipient can see internal notes (agents/admins only)
    const { data: recipientProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    const isAgentOrAdmin = recipientProfile?.role === 'agent' || recipientProfile?.role === 'admin'
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

    // CC'd-only users get a slightly different header
    if (ccUserIds.includes(userId) && userId !== p.createdBy && userId !== p.assignedTo) {
      send(user.email, templates.ccNotification(templateParams))
    } else {
      send(user.email, templates.newReply(templateParams))
    }
  }
}

/**
 * Status changed — notify the ticket creator.
 */
export async function notifyStatusChanged(p: {
  ticketId: string
  ticketTitle: string
  oldStatus: string
  newStatus: string
  changedById: string
  createdBy: string
}) {
  // Don't notify if the creator changed it themselves
  if (p.changedById === p.createdBy) return

  const users = await resolveUsers([p.createdBy, p.changedById])
  const creator = users.get(p.createdBy)
  const changer = users.get(p.changedById)

  if (creator) {
    send(creator.email, templates.statusChanged({
      ticketId: p.ticketId,
      title: p.ticketTitle,
      oldStatus: p.oldStatus,
      newStatus: p.newStatus,
      changedByName: changer?.name ?? 'An agent',
    }))
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
    send(assignee.email, templates.assignmentChanged({
      ticketId: p.ticketId,
      title: p.ticketTitle,
      assigneeName: assignee.name,
      assignedByName: assigner?.name ?? 'An admin',
    }))
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
      send(user.email, templates.userTagged({
        ticketId: p.ticketId,
        title: p.ticketTitle,
        taggedByName: tagger?.name ?? 'Someone',
      }))
    }
  }
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
    send(agent.email, templates.slaAlert({
      ticketId: p.ticketId,
      title: p.ticketTitle,
      status: p.status,
      timeInfo: p.timeInfo,
    }))
  }
}
