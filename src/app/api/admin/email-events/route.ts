import { getProfileId } from '@/lib/clerk/resolve-id'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

/**
 * GET /api/admin/email-events  (admin-only)
 *
 *   (no query) → the "bounce list": the latest delivery-failure event per
 *     recipient whose most-recent failure hasn't been superseded. Used to
 *     show which addresses Resend is currently bouncing / suppressing.
 *
 *   ?recipient=<email> → the full recent event timeline for one address.
 */

const FAILURE_TYPES = ['bounced', 'complained', 'failed', 'suppressed']

export async function GET(request: Request) {
  const callerId = await getProfileId()
  if (!callerId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data: caller } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', callerId)
    .single()

  if (caller?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const recipient = searchParams.get('recipient')?.trim().toLowerCase()

  if (recipient) {
    const { data, error } = await supabase
      .from('email_events')
      .select(
        'id, event_type, subject, bounce_type, bounce_subtype, reason, resend_email_id, event_at',
      )
      .eq('recipient', recipient)
      .order('event_at', { ascending: false })
      .limit(100)
    if (error) {
      console.error('[email-events] recipient query failed:', error)
      return NextResponse.json({ error: 'Query failed' }, { status: 500 })
    }
    return NextResponse.json({ recipient, events: data ?? [] })
  }

  // Bounce list: most-recent failure per recipient.
  const { data, error } = await supabase
    .from('email_events')
    .select(
      'recipient, event_type, subject, bounce_type, bounce_subtype, reason, resend_email_id, event_at',
    )
    .in('event_type', FAILURE_TYPES)
    .order('event_at', { ascending: false })
    .limit(1000)
  if (error) {
    console.error('[email-events] issues query failed:', error)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  const seen = new Set<string>()
  const issues: typeof data = []
  for (const e of data ?? []) {
    if (seen.has(e.recipient)) continue
    seen.add(e.recipient)
    issues.push(e)
  }

  return NextResponse.json({ issues, count: issues.length })
}
