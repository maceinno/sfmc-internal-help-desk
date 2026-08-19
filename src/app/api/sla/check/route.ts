import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSlaStatus, formatTimeRemaining } from '@/lib/sla/calculator'
import { hydrateMessages } from '@/lib/messages/hydrate'
import { notifySlaAlert } from '@/lib/email/notify'
import { planSlaAlert, eligibleQueueRecipients } from '@/lib/sla/alerting'
import type { Ticket, SlaPolicy, DepartmentSchedule } from '@/types/ticket'

// ── Auth helper ─────────────────────────────────────────────────

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  // Check Authorization header first (preferred for Vercel Cron)
  const authHeader = request.headers.get('authorization')
  if (authHeader === `Bearer ${secret}`) return true

  // Fallback: query parameter
  const { searchParams } = request.nextUrl
  if (searchParams.get('secret') === secret) return true

  return false
}

// ── GET handler (Vercel Cron sends GET requests) ────────────────

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // 1. Fetch all non-solved tickets (with their messages for SLA calc)
  // The `author:profiles(role)` join feeds role-based agent detection in
  // getActiveMetric so a CC'd colleague's reply doesn't get mistaken for
  // an agent reply (and an agent who created their own ticket is still
  // recognized when they reply).
  const { data: tickets, error: ticketsErr } = await supabase
    .from('tickets')
    .select('*, messages(*, author:profiles(role))')
    .neq('status', 'solved')

  if (ticketsErr) {
    return Response.json(
      { error: 'Failed to fetch tickets', details: ticketsErr.message },
      { status: 500 },
    )
  }

  // 2. Fetch all SLA policies
  const { data: policiesRaw, error: policiesErr } = await supabase
    .from('sla_policies')
    .select('*')
    .order('sort_order', { ascending: true })

  if (policiesErr) {
    return Response.json(
      { error: 'Failed to fetch SLA policies', details: policiesErr.message },
      { status: 500 },
    )
  }

  // 3. Fetch department schedules so SLA calculations honor business hours.
  const { data: schedulesRaw } = await supabase
    .from('department_schedules')
    .select('*')

  const policies = (policiesRaw ?? []) as SlaPolicy[]
  const schedules = (schedulesRaw ?? []) as DepartmentSchedule[]
  const allTickets = ((tickets ?? []) as Array<Record<string, unknown>>).map(
    (t) => ({
      ...t,
      messages: hydrateMessages(t.messages as Array<Record<string, unknown>> | null),
    }),
  ) as Ticket[]

  let atRiskCount = 0
  let notificationsCreated = 0
  let skippedStaleBreach = 0
  let skippedAlreadySent = 0
  let skippedNoAudience = 0

  for (const ticket of allTickets) {
    const sla = getSlaStatus(ticket, policies, schedules)
    if (!sla) continue

    const plan = planSlaAlert({
      isAtRisk: sla.isAtRisk,
      isOverdue: sla.isOverdue,
      slaDeadline: sla.slaDeadline,
    })

    if (!plan.alert) {
      if (plan.reason === 'stale_breach') {
        atRiskCount++
        skippedStaleBreach++
      }
      continue
    }

    atRiskCount++

    // ── Who hears about it ──────────────────────────────────────────────────
    // An assignee owns it. Otherwise fan out to the ticket's queue: an
    // unassigned ticket used to be skipped entirely, which silenced exactly
    // the tickets nobody was watching.
    let recipientIds: string[] = []
    let queueName: string | undefined

    if (ticket.assigned_to) {
      recipientIds = [ticket.assigned_to]
    } else if (ticket.assigned_team) {
      const { data: members, error: membersErr } = await supabase
        .from('profiles')
        .select('id, email, role, is_out_of_office, is_active')
        .contains('team_ids', [ticket.assigned_team])

      if (membersErr) {
        console.error(
          `[sla/check] Failed to load queue members for ${ticket.id}:`,
          membersErr.message,
        )
        continue
      }

      recipientIds = eligibleQueueRecipients(members)

      const { data: team } = await supabase
        .from('teams')
        .select('name')
        .eq('id', ticket.assigned_team)
        .maybeSingle()
      queueName = team?.name ?? undefined
    }

    if (recipientIds.length === 0) {
      skippedNoAudience++
      continue
    }

    // ── Send once, and only once ────────────────────────────────────────────
    // Claim the alert in the ledger BEFORE emailing. The unique key is
    // (ticket, stage, metric, deadline), so a repeat run — or two overlapping
    // runs — gets zero rows back here and sends nothing. Keying on the
    // deadline (not just the ticket) means a restarted clock, e.g. the
    // next-reply deadline that replaces the first-reply one, can warn again.
    const { data: claimed, error: claimErr } = await supabase
      .from('sla_alerts')
      .upsert(
        {
          ticket_id: ticket.id,
          stage: plan.stage,
          metric: sla.metric,
          sla_deadline: sla.slaDeadline.toISOString(),
          recipients: recipientIds.length,
        },
        {
          onConflict: 'ticket_id,stage,metric,sla_deadline',
          ignoreDuplicates: true,
        },
      )
      .select('id')

    if (claimErr) {
      console.error(
        `[sla/check] Failed to claim ${plan.stage} alert for ${ticket.id}:`,
        claimErr.message,
      )
      continue
    }

    // No row back = another run already sent this exact alert.
    if (!claimed || claimed.length === 0) {
      skippedAlreadySent++
      continue
    }

    // ── In-app notifications ────────────────────────────────────────────────
    const isBreach = plan.stage === 'breach'
    const message = isBreach
      ? `SLA breached for ticket "${ticket.title}"`
      : `SLA is about to expire for ticket "${ticket.title}"`

    const { error: insertErr } = await supabase.from('notifications').insert(
      recipientIds.map((userId) => ({
        type: 'sla_at_risk' as const,
        ticket_id: ticket.id,
        ticket_title: ticket.title,
        from_user_id: 'system',
        to_user_id: userId,
        message,
        read: false,
      })),
    )

    if (insertErr) {
      // The email is the alert that matters — log and carry on rather than
      // dropping it because the in-app copy failed.
      console.error(
        `[sla/check] Error creating notifications for ticket ${ticket.id}:`,
        insertErr.message,
      )
    }

    // ── Email ───────────────────────────────────────────────────────────────
    await notifySlaAlert({
      ticketId: ticket.id,
      ticketTitle: ticket.title,
      recipientIds,
      status: isBreach ? 'breached' : 'at_risk',
      timeInfo: isBreach
        ? `SLA breached — overdue by ${formatTimeRemaining(sla.timeRemainingMs)}`
        : `SLA about to expire — ${formatTimeRemaining(sla.timeRemainingMs)} remaining`,
      queueName,
    })

    notificationsCreated++
  }

  return Response.json({
    checked: allTickets.length,
    atRisk: atRiskCount,
    notificationsCreated,
    skippedAlreadySent,
    skippedStaleBreach,
    skippedNoAudience,
  })
}
