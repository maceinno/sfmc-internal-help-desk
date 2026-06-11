import { NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/webhooks/resend-events
 *
 * Receives Resend delivery events (email.sent / delivered / delivery_delayed /
 * bounced / complained / failed / suppressed) and records them in
 * `email_events` for the admin "Email Delivery" page.
 *
 * Setup: in the Resend dashboard create a Webhook pointing at this route,
 * subscribe to the email.* events, and put its signing secret in
 * RESEND_EVENTS_WEBHOOK_SECRET. This is a SEPARATE endpoint + secret from the
 * inbound-email webhook (which uses RESEND_WEBHOOK_SECRET).
 */

interface ResendEvent {
  type: string // e.g. 'email.bounced'
  created_at: string
  data: {
    email_id?: string
    to?: string[] | string
    from?: string
    subject?: string
    created_at?: string
    bounce?: { message?: string; type?: string; subType?: string }
    reason?: string
    [k: string]: unknown
  }
}

export async function POST(request: Request) {
  const secret = process.env.RESEND_EVENTS_WEBHOOK_SECRET
  if (!secret) {
    console.error('[resend-events] Missing RESEND_EVENTS_WEBHOOK_SECRET env var')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const h = await headers()
  const svixId = h.get('svix-id')
  const svixTimestamp = h.get('svix-timestamp')
  const svixSignature = h.get('svix-signature')
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing webhook headers' }, { status: 400 })
  }

  const raw = await request.text()
  let event: ResendEvent
  try {
    event = new Webhook(secret).verify(raw, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ResendEvent
  } catch (err) {
    console.error('[resend-events] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const eventType = (event.type ?? '').replace(/^email\./, '') || 'unknown'
  const data = event.data ?? {}
  const toArr = Array.isArray(data.to) ? data.to : data.to ? [data.to] : []
  const recipient = (toArr[0] ?? '').toLowerCase()

  // Nothing actionable without a recipient — ack so Resend doesn't retry.
  if (!recipient) {
    return NextResponse.json({ ok: true, skipped: 'no recipient' })
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from('email_events').upsert(
    {
      svix_id: svixId,
      resend_email_id: data.email_id ?? null,
      event_type: eventType,
      recipient,
      from_address: data.from ?? null,
      subject: data.subject ?? null,
      bounce_type: data.bounce?.type ?? null,
      bounce_subtype: data.bounce?.subType ?? null,
      reason:
        data.bounce?.message ??
        (typeof data.reason === 'string' ? data.reason : null),
      payload: event as unknown as Record<string, unknown>,
      event_at: event.created_at ?? new Date().toISOString(),
    },
    { onConflict: 'svix_id', ignoreDuplicates: true },
  )

  if (error) {
    console.error('[resend-events] Failed to store event:', error)
    return NextResponse.json({ error: 'Store failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
