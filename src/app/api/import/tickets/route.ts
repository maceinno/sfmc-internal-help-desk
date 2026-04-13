import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type {
  TicketStatus,
  TicketPriority,
  TicketCategory,
} from '@/types/ticket'

// ============================================================================
// POST /api/import/tickets — Bulk insert tickets
// ============================================================================

interface ImportTicketRow {
  title: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  category: TicketCategory | string
  createdByEmail: string
  assignedToEmail?: string
  createdAt?: string
  updatedAt?: string
  oldSystemId?: string
}

const VALID_STATUSES: TicketStatus[] = [
  'new',
  'open',
  'pending',
  'on_hold',
  'solved',
]

const VALID_PRIORITIES: TicketPriority[] = ['urgent', 'high', 'medium', 'low']

export async function POST(request: Request) {
  // ── Authenticate ──────────────────────────────────────────────────────────
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { tickets: ImportTicketRow[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (
    !body.tickets ||
    !Array.isArray(body.tickets) ||
    body.tickets.length === 0
  ) {
    return NextResponse.json(
      { error: 'Request must contain a non-empty "tickets" array' },
      { status: 400 },
    )
  }

  const supabase = createAdminClient()

  // ── Build email-to-userId lookup ──────────────────────────────────────────
  const allEmails = new Set<string>()
  body.tickets.forEach((t) => {
    if (t.createdByEmail) allEmails.add(t.createdByEmail.toLowerCase())
    if (t.assignedToEmail) allEmails.add(t.assignedToEmail.toLowerCase())
  })

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email')
    .in('email', Array.from(allEmails))

  const emailToId = new Map(
    (profiles ?? []).map((p) => [p.email.toLowerCase(), p.id]),
  )

  // ── Process each ticket ───────────────────────────────────────────────────
  let created = 0
  const errors: string[] = []

  for (let i = 0; i < body.tickets.length; i++) {
    const row = body.tickets[i]

    if (!row.title || !row.description) {
      errors.push(`Row ${i + 1}: Missing required title or description`)
      continue
    }

    // Validate status
    const status: TicketStatus = VALID_STATUSES.includes(row.status)
      ? row.status
      : 'new'

    // Validate priority
    const priority: TicketPriority = VALID_PRIORITIES.includes(row.priority)
      ? row.priority
      : 'medium'

    // Resolve creator
    const createdBy = row.createdByEmail
      ? emailToId.get(row.createdByEmail.toLowerCase())
      : null

    if (!createdBy) {
      errors.push(
        `Row ${i + 1}: Creator email "${row.createdByEmail}" not found in system`,
      )
      continue
    }

    // Resolve assignee (optional)
    const assignedTo = row.assignedToEmail
      ? emailToId.get(row.assignedToEmail.toLowerCase()) ?? null
      : null

    const ticketRow: Record<string, unknown> = {
      title: row.title,
      description: row.description,
      status,
      priority,
      category: row.category || 'General',
      created_by: createdBy,
      assigned_to: assignedTo,
      created_at: row.createdAt || new Date().toISOString(),
      updated_at: row.updatedAt || row.createdAt || new Date().toISOString(),
    }

    const { error } = await supabase.from('tickets').insert(ticketRow)

    if (error) {
      errors.push(`Row ${i + 1} ("${row.title}"): ${error.message}`)
    } else {
      created++
    }
  }

  return NextResponse.json({
    created,
    errors,
    total: body.tickets.length,
  })
}
