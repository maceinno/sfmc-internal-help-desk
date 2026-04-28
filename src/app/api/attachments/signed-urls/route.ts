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

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
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

    if (!ccRow && !collabRow) {
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
