import { clerkClient } from '@clerk/nextjs/server'
import { getProfileId, resolveClerkId } from '@/lib/clerk/resolve-id'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyTicketsRequeued } from '@/lib/email/notify'
import { NextResponse } from 'next/server'

/**
 * POST /api/users/deactivate
 *
 * Admin-only. Hard-blocks (or restores) a user.
 *
 * Body: { userId: string, active: boolean }
 *
 *   active=false → DEACTIVATE
 *     - flip profiles.is_active = false (source of truth)
 *     - ban the user in Clerk (revokes sessions, refuses sign-in) and set
 *       publicMetadata.active=false so middleware bounces them immediately
 *     - hand off any OPEN ticket the user is the ASSIGNEE of: set it back to
 *       `new`, unassign, keep it on its team (falling back to the user's
 *       primary team), and email that team's queue. Tickets the user only
 *       SUBMITTED (created_by) are left assigned to whoever is solving them.
 *       Solved tickets are left untouched as historical record.
 *
 *   active=true → REACTIVATE
 *     - flip profiles.is_active = true, unban in Clerk, set
 *       publicMetadata.active=true. Tickets are not auto-reassigned back.
 *
 * Deactivate is NOT delete — the profile and all ticket history are kept.
 */
export async function POST(request: Request) {
  // Verify the caller is an admin (callerId is the profile id, possibly
  // sourced from external_id post-migration).
  const callerId = await getProfileId()
  if (!callerId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', callerId)
    .single()

  if (callerProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { userId?: string; active?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { userId, active } = body
  if (typeof userId !== 'string' || !userId) {
    return NextResponse.json({ error: 'userId is required.' }, { status: 400 })
  }
  if (typeof active !== 'boolean') {
    return NextResponse.json(
      { error: "'active' must be a boolean." },
      { status: 400 },
    )
  }

  // Lock-out guard: an admin cannot deactivate their own account.
  if (userId === callerId && active === false) {
    return NextResponse.json(
      { error: 'You cannot deactivate your own account.' },
      { status: 400 },
    )
  }

  // Confirm the target exists; grab their primary team for ticket hand-off.
  const { data: target, error: targetErr } = await supabase
    .from('profiles')
    .select('id, name, role, team_ids')
    .eq('id', userId)
    .single()

  if (targetErr || !target) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 })
  }

  // 1) Flip the DB flag (source of truth).
  const { error: updateErr } = await supabase
    .from('profiles')
    .update({ is_active: active })
    .eq('id', userId)

  if (updateErr) {
    console.error('[deactivate] Failed to update is_active:', updateErr)
    return NextResponse.json({ error: 'Failed to update user.' }, { status: 500 })
  }

  // 2) Mirror to Clerk: ban/unban + publicMetadata.active so middleware can
  //    enforce the block without a DB hit per request.
  try {
    const client = await clerkClient()
    const clerkId = await resolveClerkId(client, userId)
    if (active) {
      await client.users.unbanUser(clerkId)
    } else {
      await client.users.banUser(clerkId)
    }
    await client.users.updateUserMetadata(clerkId, {
      publicMetadata: { active },
    })
  } catch (err) {
    // Roll the DB flag back so Supabase and Clerk don't diverge.
    console.error('[deactivate] Clerk update failed, rolling back is_active:', err)
    await supabase
      .from('profiles')
      .update({ is_active: !active })
      .eq('id', userId)
    return NextResponse.json(
      { error: 'Failed to update the authentication provider. No change applied.' },
      { status: 502 },
    )
  }

  // 3) On deactivate, hand off OPEN tickets the user is the ASSIGNEE of.
  //    Requester-only tickets stay with whoever is solving them.
  let requeued = 0
  if (!active) {
    const { data: assigned, error: assignedErr } = await supabase
      .from('tickets')
      .select('id, assigned_team, title, category, priority, description')
      .eq('assigned_to', userId)
      .neq('status', 'solved')

    if (assignedErr) {
      console.error('[deactivate] Failed to load assigned tickets:', assignedErr)
      // The user is already blocked — report partial success rather than fail.
      return NextResponse.json({
        ok: true,
        requeued: 0,
        warning:
          'User deactivated, but ticket hand-off failed — reassign their open tickets manually.',
      })
    }

    const fallbackTeam = target.team_ids?.[0] ?? null

    for (const t of assigned ?? []) {
      const team = t.assigned_team ?? fallbackTeam
      const { error: reErr } = await supabase
        .from('tickets')
        .update({ status: 'new', assigned_to: null, assigned_team: team })
        .eq('id', t.id)

      if (reErr) {
        console.error(`[deactivate] Failed to requeue ticket ${t.id}:`, reErr)
        continue
      }
      requeued++

      if (team) {
        await notifyTicketsRequeued({
          ticketId: t.id,
          title: t.title,
          category: t.category,
          priority: t.priority,
          teamId: team,
          formerAgentName: target.name,
          description: t.description,
        })
      }
    }
  }

  return NextResponse.json({ ok: true, requeued })
}
