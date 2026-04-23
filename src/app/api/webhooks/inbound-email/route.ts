import { NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseReplyContent, extractTicketId } from '@/lib/email/parse-reply'
import { notifyNewReply } from '@/lib/email/notify'
import { resend } from '@/lib/email/resend'

/**
 * POST /api/webhooks/inbound-email
 *
 * Receives inbound emails from Resend (via Svix webhook).
 * The webhook payload is metadata-only by design — the body must be fetched
 * separately via resend.emails.receiving.get(email_id). This keeps the webhook
 * small enough for serverless payload limits.
 */

interface InboundEmailPayload {
  email_id: string
  from: string
  to: string | string[]
  cc?: string | string[]
  subject: string
}

export async function POST(request: Request) {
  console.log('[inbound-email] Webhook received')

  // ── Verify webhook signature ──────────────────────────────────────────────
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[inbound-email] Missing RESEND_WEBHOOK_SECRET env var')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const headerPayload = await headers()
  const svixId = headerPayload.get('svix-id')
  const svixTimestamp = headerPayload.get('svix-timestamp')
  const svixSignature = headerPayload.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.error('[inbound-email] Missing svix headers')
    return NextResponse.json({ error: 'Missing webhook headers' }, { status: 400 })
  }

  const rawBody = await request.text()

  const wh = new Webhook(webhookSecret)
  let payload: { type: string; data: InboundEmailPayload }

  try {
    payload = wh.verify(rawBody, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as { type: string; data: InboundEmailPayload }
  } catch (err) {
    console.error('[inbound-email] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Resend wraps the email data inside a { type, data } envelope
  const body = payload.data ?? (payload as unknown as InboundEmailPayload)

  console.log(`[inbound-email] Verified webhook — type: ${payload.type}`)

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

  // ── Fetch the full email body from Resend ────────────────────────────────
  // The email.received webhook only includes metadata; the text/html body must
  // be retrieved separately via the Received Emails API.
  if (!body.email_id) {
    console.error('[inbound-email] Webhook payload missing email_id')
    return NextResponse.json({ error: 'Missing email_id' }, { status: 400 })
  }

  const { data: fullEmail, error: fetchError } = await resend.emails.receiving.get(body.email_id)

  if (fetchError || !fullEmail) {
    console.error('[inbound-email] Failed to fetch received email:', fetchError)
    return NextResponse.json({ error: 'Failed to fetch email body' }, { status: 500 })
  }

  // Prefer plain text; fall back to HTML with a naive tag strip if text is missing.
  const rawText =
    fullEmail.text ??
    (fullEmail.html
      ? fullEmail.html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ')
      : '')
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
