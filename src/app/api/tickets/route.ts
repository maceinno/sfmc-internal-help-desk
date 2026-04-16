import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { applyRoutingRules } from '@/lib/routing/rule-engine'
import { notifyTicketCreated } from '@/lib/email/notify'
import type {
  TicketPriority,
  TicketCategory,
  TicketType,
  RoutingRule,
  User,
  CustomFieldValue,
} from '@/types/ticket'

// ============================================================================
// POST /api/tickets — Create a new ticket
// ============================================================================

interface CreateTicketBody {
  title: string
  description: string
  ticketType?: TicketType
  category: TicketCategory
  subCategory?: string
  priority: TicketPriority
  cc?: string[]
  customFields?: CustomFieldValue[]
  mailingAddress?: {
    street1: string
    street2?: string
    city: string
    state: string
    zip: string
  }
  parentTicketId?: string
}

export async function POST(request: Request) {
  // ── Authenticate ───────────────────────────────────────────────────────────
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parse & validate body ──────────────────────────────────────────────────
  let body: CreateTicketBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  const { title, description, category, priority } = body
  if (!title || !description || !category || !priority) {
    return NextResponse.json(
      { error: 'Missing required fields: title, description, category, priority' },
      { status: 400 },
    )
  }

  const supabase = createAdminClient()

  // ── Apply routing rules ────────────────────────────────────────────────────
  // 1. Fetch enabled routing rules, sorted by priority_order
  const { data: rulesRaw, error: rulesError } = await supabase
    .from('routing_rules')
    .select('*')
    .eq('enabled', true)
    .order('priority_order', { ascending: true })

  if (rulesError) {
    console.error('[create-ticket] Failed to fetch routing rules:', rulesError)
    return NextResponse.json(
      { error: 'Failed to fetch routing rules' },
      { status: 500 },
    )
  }

  // 2. Fetch all agent/admin profiles for team-member lookup
  const { data: profilesRaw, error: profilesError } = await supabase
    .from('profiles')
    .select('*')
    .in('role', ['agent', 'admin'])

  if (profilesError) {
    console.error('[create-ticket] Failed to fetch profiles:', profilesError)
    return NextResponse.json(
      { error: 'Failed to fetch profiles' },
      { status: 500 },
    )
  }

  // Map DB rows to domain types for the rule engine
  const routingRules: RoutingRule[] = (rulesRaw ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    enabled: r.enabled,
    ticket_type: r.ticket_type ?? 'any',
    category: r.category ?? 'any',
    assign_to_user: r.assign_to_user ?? undefined,
    assign_to_team: r.assign_to_team ?? undefined,
    priority_order: r.priority_order,
  }))

  const users: User[] = (profilesRaw ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    role: p.role,
    avatar_url: p.avatar_url ?? '',
    department: p.department ?? undefined,
    departments: p.departments ?? undefined,
    team_ids: p.team_ids ?? undefined,
    branch_id: p.branch_id ?? undefined,
    region_id: p.region_id ?? undefined,
    is_out_of_office: p.is_out_of_office ?? false,
    ticket_types_handled: p.ticket_types_handled ?? undefined,
    has_regional_access: p.has_regional_access ?? false,
    managed_region_id: p.managed_region_id ?? undefined,
    has_branch_access: p.has_branch_access ?? false,
    managed_branch_id: p.managed_branch_id ?? undefined,
  }))

  const routingResult = applyRoutingRules(
    body.ticketType,
    body.category,
    routingRules,
    users,
  )

  // ── Insert ticket ──────────────────────────────────────────────────────────
  const ticketRow: Record<string, unknown> = {
    title,
    description,
    category,
    priority,
    created_by: userId,
    ticket_type: body.ticketType ?? null,
    sub_category: body.subCategory ?? null,
    parent_ticket_id: body.parentTicketId ?? null,
    mailing_address: body.mailingAddress ?? null,
    assigned_to: routingResult.assignedTo ?? null,
    assigned_team: routingResult.assignedTeam ?? null,
  }

  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .insert(ticketRow)
    .select()
    .single()

  if (ticketError) {
    console.error('[create-ticket] Failed to insert ticket:', ticketError)
    return NextResponse.json(
      { error: 'Failed to create ticket' },
      { status: 500 },
    )
  }

  // ── Insert CC records ──────────────────────────────────────────────────────
  if (body.cc && body.cc.length > 0) {
    const ccRows = body.cc.map((uid) => ({
      ticket_id: ticket.id,
      user_id: uid,
    }))

    const { error: ccError } = await supabase
      .from('ticket_cc')
      .insert(ccRows)

    if (ccError) {
      console.error('[create-ticket] Failed to insert CC records:', ccError)
      // Non-fatal: ticket is created, but CC failed
    }
  }

  // ── Insert custom field values ─────────────────────────────────────────────
  if (body.customFields && body.customFields.length > 0) {
    const cfRows = body.customFields.map((cf) => ({
      ticket_id: ticket.id,
      field_id: cf.field_id,
      value: cf.value,
    }))

    const { error: cfError } = await supabase
      .from('custom_field_values')
      .insert(cfRows)

    if (cfError) {
      console.error('[create-ticket] Failed to insert custom field values:', cfError)
      // Non-fatal: ticket is created, but custom fields failed
    }
  }

  // ── Send email notifications (must await — Vercel kills function after response) ──
  await notifyTicketCreated({
    id: ticket.id,
    title: ticket.title,
    category: ticket.category,
    priority: ticket.priority,
    created_by: userId,
    assigned_to: ticket.assigned_to,
  })

  return NextResponse.json(ticket, { status: 201 })
}
