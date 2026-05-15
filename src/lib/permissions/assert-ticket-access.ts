// ============================================================================
// Server-side ticket access helper
// ============================================================================
//
// Single source of truth for "can this caller act on this ticket" decisions
// across every ticket-scoped API route. Mirrors the read-side `canViewTicket`
// policy in `policies.ts` so the write side can't drift from the view side.
//
// Background: between May 2026 PRs #23, #26, and #28, three separate fixes
// shipped for the same bug class — different routes hand-rolling near-
// identical allow-lists that disagreed in subtle ways (missing CC, missing
// regional, missing branch). Centralising here makes that class of drift
// impossible going forward.
//
// Usage pattern in a route:
//
//   const ticket = await supabase.from('tickets').select(...).eq('id', id).single()
//   if (!ticket) return 404
//   const access = await assertTicketAccess(supabase, userId, ticket, 'reply')
//   if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
//   // ... use access.isAgentOrAdmin / access.isCreator if needed
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * What the caller is trying to do with this ticket. Determines which allow-
 * list applies.
 *
 *   - 'respond' : creator/assignee/CC/collaborator/agent/admin OR
 *                 regional/branch manager whose managed scope matches
 *                 the ticket's creator or assignee. Used by reply,
 *                 upload/sign, and attachments/signed-urls (view of
 *                 attached files counts as "respond" because attaching
 *                 and downloading are paired actions).
 *   - 'manage'  : creator OR agent OR admin. Used for surface-level
 *                 ticket controls that aren't full agent ops — currently
 *                 CC list management.
 *   - 'admin'   : agent or admin only. Used for ticket merging and
 *                 the system-event notify endpoint.
 */
export type TicketAction = 'respond' | 'manage' | 'admin'

/**
 * The minimum ticket shape we need. Routes already fetch the ticket for
 * their own business logic; we accept it as a parameter rather than re-
 * fetching to avoid a duplicate query.
 */
export interface TicketAccessRow {
  created_by: string
  assigned_to: string | null
}

export type AssertTicketAccessResult =
  | {
      ok: true
      isAgentOrAdmin: boolean
      isCreator: boolean
      isAssignee: boolean
    }
  | {
      ok: false
      status: 403
      error: string
    }

/**
 * Check whether `userId` is allowed to perform `action` on `ticket`. The
 * helper handles the profile lookup and any required joins (ticket_cc,
 * ticket_collaborators, region/branch).
 *
 * Returns either a successful result with the role flags the caller may
 * want for follow-up logic (e.g. reply's auto-reopen check needs
 * `isAgentOrAdmin`), or a fail result with a status + error string to
 * pass straight into NextResponse.json. The error string is intentionally
 * generic — we don't want to leak which arm of the allow-list rejected
 * the caller.
 */
export async function assertTicketAccess(
  supabase: SupabaseClient,
  userId: string,
  ticketId: string,
  ticket: TicketAccessRow,
  action: TicketAction,
): Promise<AssertTicketAccessResult> {
  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'role, has_regional_access, managed_region_id, has_branch_access, managed_branch_id',
    )
    .eq('id', userId)
    .single()

  const isAgentOrAdmin =
    profile?.role === 'agent' || profile?.role === 'admin'
  const isCreator = ticket.created_by === userId
  const isAssignee = ticket.assigned_to === userId

  // ── 'admin' action: agent/admin only ──────────────────────────────────────
  if (action === 'admin') {
    if (!isAgentOrAdmin) {
      return { ok: false, status: 403, error: 'Forbidden' }
    }
    return { ok: true, isAgentOrAdmin, isCreator, isAssignee }
  }

  // ── 'manage' action: creator OR agent/admin ───────────────────────────────
  if (action === 'manage') {
    if (!isAgentOrAdmin && !isCreator) {
      return { ok: false, status: 403, error: 'Forbidden' }
    }
    return { ok: true, isAgentOrAdmin, isCreator, isAssignee }
  }

  // ── 'respond' action: full allow-list mirroring canViewTicket ─────────────
  if (isAgentOrAdmin || isCreator || isAssignee) {
    return { ok: true, isAgentOrAdmin, isCreator, isAssignee }
  }

  const { data: ccRow } = await supabase
    .from('ticket_cc')
    .select('user_id')
    .eq('ticket_id', ticketId)
    .eq('user_id', userId)
    .maybeSingle()
  if (ccRow) return { ok: true, isAgentOrAdmin, isCreator, isAssignee }

  const { data: collabRow } = await supabase
    .from('ticket_collaborators')
    .select('user_id')
    .eq('ticket_id', ticketId)
    .eq('user_id', userId)
    .maybeSingle()
  if (collabRow) return { ok: true, isAgentOrAdmin, isCreator, isAssignee }

  if (profile?.has_regional_access || profile?.has_branch_access) {
    const partyIds = [ticket.created_by, ticket.assigned_to].filter(
      (id): id is string => !!id,
    )
    if (partyIds.length > 0) {
      const { data: parties } = await supabase
        .from('profiles')
        .select('id, region_id, branch_id')
        .in('id', partyIds)

      const regionMatch =
        !!profile.has_regional_access &&
        !!profile.managed_region_id &&
        (parties ?? []).some(
          (p) => p.region_id === profile.managed_region_id,
        )
      const branchMatch =
        !!profile.has_branch_access &&
        !!profile.managed_branch_id &&
        (parties ?? []).some(
          (p) => p.branch_id === profile.managed_branch_id,
        )

      if (regionMatch || branchMatch) {
        return { ok: true, isAgentOrAdmin, isCreator, isAssignee }
      }
    }
  }

  return {
    ok: false,
    status: 403,
    error: 'You do not have access to this ticket',
  }
}
