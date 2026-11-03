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
 *   ?recipient=<email> → the full recent event timeline for one address,
 *     plus every send attempt recorded for it (email_send_log, 023).
 *
 *   ?view=attempts → last-7-day send attempt counts and the addresses whose
 *     latest attempt was refused or errored (see sendAttemptSummary).
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
    const [{ data, error }, attemptsRes] = await Promise.all([
      supabase
        .from('email_events')
        .select(
          'id, event_type, subject, bounce_type, bounce_subtype, reason, resend_email_id, event_at',
        )
        .eq('recipient', recipient)
        .order('event_at', { ascending: false })
        .limit(100),
      supabase
        .from('email_send_log')
        .select('id, attempted_at, subject, ticket_id, outcome, resend_email_id, error_name, error_message')
        .eq('recipient', recipient)
        .order('attempted_at', { ascending: false })
        .limit(100),
    ])
    if (error) {
      console.error('[email-events] recipient query failed:', error)
      return NextResponse.json({ error: 'Query failed' }, { status: 500 })
    }
    // email_send_log arrives with migration 023 — before it is applied the
    // page still works, it just has no attempts to show.
    if (attemptsRes.error) {
      console.warn('[email-events] send log unavailable:', attemptsRes.error.message)
    }
    return NextResponse.json({
      recipient,
      events: data ?? [],
      attempts: attemptsRes.data ?? [],
      sendLogReady: !attemptsRes.error,
    })
  }

  if (searchParams.get('view') === 'attempts') {
    return NextResponse.json(await sendAttemptSummary(supabase))
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

const ATTEMPT_WINDOW_DAYS = 7

/**
 * `?view=attempts` — from email_send_log (migration 023): how many sends were
 * tried in the last 7 days and how each went, plus the latest refusal/error
 * per address that has NOT been followed by an accepted send since.
 */
async function sendAttemptSummary(supabase: ReturnType<typeof createAdminClient>) {
  const since = new Date(Date.now() - ATTEMPT_WINDOW_DAYS * 864e5).toISOString()

  const counts = await Promise.all(
    (['accepted', 'refused', 'error'] as const).map((outcome) =>
      supabase
        .from('email_send_log')
        .select('id', { count: 'exact', head: true })
        .eq('outcome', outcome)
        .gte('attempted_at', since),
    ),
  )
  const countErr = counts.find((c) => c.error)?.error
  if (countErr) {
    console.warn('[email-events] send log unavailable:', countErr.message)
    return { sendLogReady: false, days: ATTEMPT_WINDOW_DAYS, counts: null, problems: [] }
  }

  const { data: failures } = await supabase
    .from('email_send_log')
    .select('recipient, attempted_at, subject, ticket_id, outcome, error_name, error_message')
    .in('outcome', ['refused', 'error'])
    .gte('attempted_at', since)
    .order('attempted_at', { ascending: false })
    .limit(1000)

  const latestFailure = new Map<string, NonNullable<typeof failures>[number]>()
  for (const f of failures ?? []) {
    if (!latestFailure.has(f.recipient)) latestFailure.set(f.recipient, f)
  }

  // Drop addresses that have been accepted since their last failure.
  const recipients = [...latestFailure.keys()]
  const lastAccepted = new Map<string, string>()
  for (let i = 0; i < recipients.length; i += 100) {
    const { data } = await supabase
      .from('email_send_log')
      .select('recipient, attempted_at')
      .eq('outcome', 'accepted')
      .in('recipient', recipients.slice(i, i + 100))
      .gte('attempted_at', since)
      .order('attempted_at', { ascending: false })
      .limit(1000)
    for (const a of data ?? []) {
      if (!lastAccepted.has(a.recipient)) lastAccepted.set(a.recipient, a.attempted_at)
    }
  }
  const problems = [...latestFailure.values()].filter((f) => {
    const ok = lastAccepted.get(f.recipient)
    return !ok || new Date(ok).getTime() < new Date(f.attempted_at).getTime()
  })

  return {
    sendLogReady: true,
    days: ATTEMPT_WINDOW_DAYS,
    counts: {
      accepted: counts[0].count ?? 0,
      refused: counts[1].count ?? 0,
      error: counts[2].count ?? 0,
    },
    problems,
  }
}
