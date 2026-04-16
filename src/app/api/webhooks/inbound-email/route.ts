import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseReplyContent, extractTicketId } from '@/lib/email/parse-reply'
import { notifyNewReply } from '@/lib/email/notify'

/**
 * POST /api/webhooks/inbound-email
 *
 * Receives inbound emails from Resend. When someone replies to a
 * ticket notification email, this webhook:
 * 1. Extracts the ticket ID from the To address
 * 2. Looks up the sender by email → Supabase profile
 * 3. Strips quoted text to get only the new reply
 * 4. Inserts a message on the ticket
 * 5. Triggers reply notifications to other parties
 *
 * Resend inbound webhook payload:
 * {
 *   from: "user@example.com",
 *   to: "ticket+T-1064@support.sfmc.com",
 *   subject: "Re: [T-1064] ...",
 *   text: "plain text body",
 *   html: "html body",
 *   headers: { ... }
 * }
 */

interface InboundEmailPayload {
  from: string
  to: string | string[]
  cc?: string | string[]
  subject: string
  text?: string
  html?: string
}

export async function POST(request: Request) {
  console.log('[inbound-email] Webhook received')

  let body: InboundEmailPayload
  try {
    body = await request.json()
  } catch {
    console.error('[inbound-email] Invalid JSON body')
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // ── Extract ticket ID from the To address ─────────────────────────────────
  const toAddresses = Array.isArray(body.to) ? body.to : [body.to]
  let ticketId: string | null = null

  for (const addr of toAddresses) {
    ticketId = extractTicketId(addr)
    if (ticketId) break
  }

  if (!ticketId) {
    console.log('[inbound-email] No ticket ID found in To addresses:', toAddresses)
    return NextResponse.json({ error: 'No ticket ID in address' }, { status: 200 })
  }

  console.log(`[inbound-email] Ticket ID: ${ticketId}, From: ${body.from}`)

  // ── Extract sender email ──────────────────────────────────────────────────
  // "from" can be "Name <email>" or just "email"
  const emailMatch = body.from.match(/<([^>]+)>/) ?? body.from.match(/([^\s]+@[^\s]+)/)
  const senderEmail = emailMatch ? emailMatch[1].toLowerCase() : body.from.toLowerCase()

  // ── Look up sender in Supabase ────────────────────────────────────────────
  const supabase = createAdminClient()

  const { data: senderProfile } = await supabase
    .from('profiles')
    .select('id, name, role')
    .eq('email', senderEmail)
    .single()

  if (!senderProfile) {
    console.log(`[inbound-email] Unknown sender: ${senderEmail}`)
    // Still return 200 so Resend doesn't retry
    return NextResponse.json({ error: 'Unknown sender' }, { status: 200 })
  }

  // ── Verify ticket exists ──────────────────────────────────────────────────
  const { data: ticket } = await supabase
    .from('tickets')
    .select('id, title, status, created_by, assigned_to')
    .eq('id', ticketId)
    .single()

  if (!ticket) {
    console.log(`[inbound-email] Ticket not found: ${ticketId}`)
    return NextResponse.json({ error: 'Ticket not found' }, { status: 200 })
  }

  // ── Parse the reply content ───────────────────────────────────────────────
  // Prefer plain text over HTML for cleaner parsing
  const rawText = body.text ?? ''
  const replyContent = parseReplyContent(rawText)

  if (!replyContent) {
    console.log(`[inbound-email] Empty reply after parsing for ticket ${ticketId}`)
    return NextResponse.json({ error: 'Empty reply' }, { status: 200 })
  }

  console.log(`[inbound-email] Parsed reply (${replyContent.length} chars) from ${senderProfile.name} on ${ticketId}`)

  // ── Insert the message ────────────────────────────────────────────────────
  const isInternal = false // Email replies are always public
  const { data: message, error: messageError } = await supabase
    .from('messages')
    .insert({
      ticket_id: ticketId,
      author_id: senderProfile.id,
      content: replyContent,
      is_internal: isInternal,
    })
    .select()
    .single()

  if (messageError) {
    console.error('[inbound-email] Failed to insert message:', messageError)
    return NextResponse.json({ error: 'Failed to save message' }, { status: 500 })
  }

  // ── Touch ticket updated_at ───────────────────────────────────────────────
  await supabase
    .from('tickets')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', ticketId)

  // ── Reopen ticket if it was solved ────────────────────────────────────────
  if (ticket.status === 'solved') {
    await supabase
      .from('tickets')
      .update({ status: 'open' })
      .eq('id', ticketId)

    console.log(`[inbound-email] Reopened solved ticket ${ticketId}`)
  }

  // ── Send notifications to other parties ───────────────────────────────────
  await notifyNewReply({
    ticketId,
    ticketTitle: ticket.title,
    authorId: senderProfile.id,
    content: replyContent,
    isInternal,
    createdBy: ticket.created_by,
    assignedTo: ticket.assigned_to,
  })

  console.log(`[inbound-email] Successfully processed reply on ${ticketId} from ${senderProfile.name}`)

  return NextResponse.json({ ok: true, messageId: message.id })
}
