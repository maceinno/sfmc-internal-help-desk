import { NextResponse } from 'next/server'
import { getProfileId } from '@/lib/clerk/resolve-id'
import { createAdminClient } from '@/lib/supabase/admin'
import { htmlToPlainText } from '@/lib/html/to-plain-text'
import {
  escapeLikeTerm,
  MIN_REPLY_SEARCH_TERM_LENGTH,
  type ReplyMatch,
} from '@/lib/tickets/search'

// ============================================================================
// GET /api/tickets/search-replies?q=<term>
// ============================================================================
//
// Finds tickets whose REPLY THREAD mentions the search term. Everything else
// a search can match — subject, ticket number, description, Lead/Loan Number,
// Borrower Name, the people on the ticket — is matched in the browser against
// the already-loaded ticket list (`lib/tickets/search.ts`). Replies are the
// one part that cannot be: there are ~17.7k of them and their bodies are not
// in the list payload, so they are searched here instead.
//
// The caller merges these ticket ids into its own results, so this route
// returns ids and a short snippet, never whole messages.
//
// Access:
//   * agent / admin — every ticket, matching migration 017.
//   * employee      — only tickets they created, are assigned, are CC'd on or
//                     collaborate on. Internal notes are excluded outright,
//                     so an internal note can never surface a ticket to an
//                     employee or leak a snippet of itself.
// ============================================================================

/** Hard ceiling on rows scanned, so a one-character term can't scan the table. */
const MESSAGE_MATCH_LIMIT = 400

export async function GET(request: Request) {
  const userId = await getProfileId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const term = (new URL(request.url).searchParams.get('q') ?? '').trim()
  if (term.length < MIN_REPLY_SEARCH_TERM_LENGTH) {
    return NextResponse.json({ matches: [] })
  }

  const supabase = createAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const isAgentOrAdmin = profile.role === 'agent' || profile.role === 'admin'

  let query = supabase
    .from('messages')
    .select('ticket_id, content, author_id, created_at, is_internal')
    .ilike('content', `%${escapeLikeTerm(term)}%`)
    .order('created_at', { ascending: false })
    .limit(MESSAGE_MATCH_LIMIT)

  // System events ("changed status to open") are noise in a search — they
  // repeat the same handful of phrases across thousands of tickets.
  query = query.or('is_system.is.null,is_system.eq.false')

  if (!isAgentOrAdmin) {
    query = query.eq('is_internal', false)
  }

  const { data: rows, error } = await query
  if (error) {
    console.error('[search-replies] message query failed:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }

  let allowedTicketIds: Set<string> | null = null

  if (!isAgentOrAdmin) {
    // Narrow the candidate tickets down to the ones this employee may see.
    const candidateIds = [...new Set((rows ?? []).map((r) => r.ticket_id))]
    allowedTicketIds = new Set<string>()

    if (candidateIds.length > 0) {
      const [own, cc, collab] = await Promise.all([
        supabase
          .from('tickets')
          .select('id')
          .in('id', candidateIds)
          .or(`created_by.eq.${userId},assigned_to.eq.${userId}`),
        supabase
          .from('ticket_cc')
          .select('ticket_id')
          .in('ticket_id', candidateIds)
          .eq('user_id', userId),
        supabase
          .from('ticket_collaborators')
          .select('ticket_id')
          .in('ticket_id', candidateIds)
          .eq('user_id', userId),
      ])

      for (const r of own.data ?? []) allowedTicketIds.add(r.id)
      for (const r of cc.data ?? []) allowedTicketIds.add(r.ticket_id)
      for (const r of collab.data ?? []) allowedTicketIds.add(r.ticket_id)
    }
  }

  // One match per ticket — the most recent, since rows are ordered by date.
  const seen = new Set<string>()
  const matches: ReplyMatch[] = []
  for (const row of rows ?? []) {
    if (allowedTicketIds && !allowedTicketIds.has(row.ticket_id)) continue
    if (seen.has(row.ticket_id)) continue
    seen.add(row.ticket_id)

    const plain = htmlToPlainText(row.content ?? '').replace(/\s+/g, ' ').trim()
    matches.push({
      ticketId: row.ticket_id,
      snippet: plain.length > 160 ? plain.slice(0, 160) + '...' : plain,
      authorId: row.author_id,
      createdAt: row.created_at,
      isInternal: row.is_internal === true,
    })
  }

  return NextResponse.json({ matches })
}
