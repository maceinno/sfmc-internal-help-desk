import { NextResponse } from 'next/server'
import { getProfileId } from '@/lib/clerk/resolve-id'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertTicketAccess } from '@/lib/permissions/assert-ticket-access'
import {
  withDownloadName,
  downloadNameFromStoragePath,
} from '@/lib/upload/download-url'

/**
 * POST /api/attachments/signed-urls
 *
 * Generates time-limited signed URLs for ticket attachments.
 * Verifies the caller has access to the ticket before generating URLs.
 *
 * Body: { ticketId: string, storagePaths: string[] }
 * Returns: {
 *   urls:         Record<string, string>  (storagePath -> signedUrl, for inline previews)
 *   downloadUrls: Record<string, string>  (storagePath -> signedUrl that saves
 *                                          under the uploader's original filename)
 * }
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

  const access = await assertTicketAccess(
    supabase,
    userId,
    body.ticketId,
    ticket,
    'respond',
  )
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  // The storage key is prefixed with a UUID for uniqueness, so we need the
  // row's `file_name` to tell the browser what to save the download as.
  // Scoped to this ticket, which is the ticket we just authorised.
  const { data: rows } = await supabase
    .from('attachments')
    .select('storage_path, file_name')
    .eq('ticket_id', body.ticketId)
    .in('storage_path', body.storagePaths)

  const nameByPath = new Map<string, string>(
    (rows ?? []).map((r) => [r.storage_path as string, r.file_name as string]),
  )

  // Generate signed URLs for all paths
  const urls: Record<string, string> = {}
  const downloadUrls: Record<string, string> = {}

  for (const path of body.storagePaths) {
    const { data, error } = await supabase.storage
      .from('attachments')
      .createSignedUrl(path, SIGNED_URL_EXPIRY)

    if (!error && data?.signedUrl) {
      urls[path] = data.signedUrl
      downloadUrls[path] = withDownloadName(
        data.signedUrl,
        nameByPath.get(path) || downloadNameFromStoragePath(path),
      )
    }
  }

  return NextResponse.json({ urls, downloadUrls })
}
