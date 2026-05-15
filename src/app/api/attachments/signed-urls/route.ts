import { NextResponse } from 'next/server'
import { getProfileId } from '@/lib/clerk/resolve-id'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/attachments/signed-urls
 *
 * Generates time-limited signed URLs for ticket attachments.
 * Verifies the caller has access to the ticket before generating URLs.
 *
 * Body: { ticketId: string, storagePaths: string[] }
 * Returns: { urls: Record<string, string> }  (storagePath -> signedUrl)
 *
 * URLs expire after 1 hour.
 */

const SIGNED_URL_EXPIRY = 60 * 60 // 1 hour in seconds

export async function POST(request: Request) {
  const userId = await getProfileId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { ticketId: string; storagePaths: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.ticketId || !body.storagePaths?.length) {
    return NextResponse.json({ error: 'ticketId and storagePaths required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Verify ticket exists and user has access
  const { data: ticket } = await supabase
    .from('tickets')
    .select('id, created_by, assigned_to')
    .eq('id', body.ticketId)
    .single()

  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
  }

  // Mirrors src/lib/permissions/policies.ts canViewTicket + the reply route
  // and /api/upload/sign access gates. Without the regional/branch path
  // here, managers see the ticket and post replies but their attachment
  // thumbnails / downloads 403 silently.
  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'role, has_regional_access, managed_region_id, has_branch_access, managed_branch_id',
    )
    .eq('id', userId)
    .single()

  const isAgentOrAdmin = profile?.role === 'agent' || profile?.role === 'admin'
  const isCreator = ticket.created_by === userId
  const isAssignee = ticket.assigned_to === userId

  if (!isAgentOrAdmin && !isCreator && !isAssignee) {
    // Check CC and collaborators
    const { data: ccRow } = await supabase
      .from('ticket_cc')
      .select('user_id')
      .eq('ticket_id', body.ticketId)
      .eq('user_id', userId)
      .maybeSingle()

    const { data: collabRow } = await supabase
      .from('ticket_collaborators')
      .select('user_id')
      .eq('ticket_id', body.ticketId)
      .eq('user_id', userId)
      .maybeSingle()

    let hasRegionalOrBranchAccess = false
    if (
      !ccRow &&
      !collabRow &&
      (profile?.has_regional_access || profile?.has_branch_access)
    ) {
      const partyIds = [ticket.created_by, ticket.assigned_to].filter(
        (id): id is string => !!id,
      )
      if (partyIds.length > 0) {
        const { data: parties } = await supabase
          .from('profiles')
          .select('id, region_id, branch_id')
          .in('id', partyIds)

        const regionMatch =
          !!profile?.has_regional_access &&
          !!profile.managed_region_id &&
          (parties ?? []).some(
            (p) => p.region_id === profile.managed_region_id,
          )
        const branchMatch =
          !!profile?.has_branch_access &&
          !!profile.managed_branch_id &&
          (parties ?? []).some(
            (p) => p.branch_id === profile.managed_branch_id,
          )

        hasRegionalOrBranchAccess = regionMatch || branchMatch
      }
    }

    if (!ccRow && !collabRow && !hasRegionalOrBranchAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }
  }

  // Generate signed URLs for all paths
  const urls: Record<string, string> = {}

  for (const path of body.storagePaths) {
    const { data, error } = await supabase.storage
      .from('attachments')
      .createSignedUrl(path, SIGNED_URL_EXPIRY)

    if (!error && data?.signedUrl) {
      urls[path] = data.signedUrl
    }
  }

  return NextResponse.json({ urls })
}
