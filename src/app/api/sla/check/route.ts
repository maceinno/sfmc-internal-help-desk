import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSlaStatus } from '@/lib/sla/calculator'
import type { Ticket, SlaPolicy } from '@/types/ticket'

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
  const { data: tickets, error: ticketsErr } = await supabase
    .from('tickets')
    .select('*, messages(*)')
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

  const policies = (policiesRaw ?? []) as SlaPolicy[]
  const allTickets = (tickets ?? []) as Ticket[]

  let atRiskCount = 0
  let notificationsCreated = 0

  for (const ticket of allTickets) {
    const sla = getSlaStatus(ticket, policies)
    if (!sla || (!sla.isAtRisk && !sla.isOverdue)) continue

    atRiskCount++

    // Only notify if the ticket has an assigned agent
    if (!ticket.assigned_to) continue

    // Check for an existing sla_at_risk notification for this ticket in the
    // last hour to avoid duplicate noise.
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    const { data: existing, error: existingErr } = await supabase
      .from('notifications')
      .select('id')
      .eq('ticket_id', ticket.id)
      .eq('type', 'sla_at_risk')
      .eq('to_user_id', ticket.assigned_to)
      .gte('created_at', oneHourAgo)
      .limit(1)

    if (existingErr) {
      // Log but don't fail the whole run
      console.error(
        `[sla/check] Error checking existing notification for ticket ${ticket.id}:`,
        existingErr.message,
      )
      continue
    }

    if (existing && existing.length > 0) continue

    // Create notification for the assigned agent
    const statusLabel = sla.isOverdue ? 'overdue' : 'at risk'
    const { error: insertErr } = await supabase.from('notifications').insert({
      type: 'sla_at_risk',
      ticket_id: ticket.id,
      ticket_title: ticket.title,
      from_user_id: 'system',
      to_user_id: ticket.assigned_to,
      message: `SLA is ${statusLabel} for ticket "${ticket.title}"`,
      read: false,
    })

    if (insertErr) {
      console.error(
        `[sla/check] Error creating notification for ticket ${ticket.id}:`,
        insertErr.message,
      )
      continue
    }

    notificationsCreated++
  }

  return Response.json({
    checked: allTickets.length,
    atRisk: atRiskCount,
    notificationsCreated,
  })
}
