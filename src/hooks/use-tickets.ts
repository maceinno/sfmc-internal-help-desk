'use client'

import {
  useQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { toast } from 'sonner'
import { createClerkSupabaseClient } from '@/lib/supabase/client'
import { uploadFileDirect } from '@/lib/upload/direct-upload'
import { hydrateMessages } from '@/lib/messages/hydrate'
import {
  latestUpdatedAt,
  mergeChangedTickets,
  patchTicketInList,
} from '@/lib/tickets/list-cache'
import type {
  Ticket,
  TicketStatus,
  TicketPriority,
  TicketCategory,
} from '@/types'

// ── Query keys ──────────────────────────────────────────────────

export const ticketKeys = {
  all: ['tickets'] as const,
  lists: () => [...ticketKeys.all, 'list'] as const,
  list: (filters: TicketFilters) => [...ticketKeys.lists(), filters] as const,
  details: () => [...ticketKeys.all, 'detail'] as const,
  detail: (id: string) => [...ticketKeys.details(), id] as const,
}

// ── Filter types ────────────────────────────────────────────────

export interface TicketFilters {
  status?: TicketStatus
  priority?: TicketPriority
  category?: TicketCategory
  assignedTo?: string
}

// ── Hooks ───────────────────────────────────────────────────────

/**
 * How long the shared ticket list is considered fresh.
 *
 * This query is the single heaviest thing the app does, and EVERY portal
 * screen calls it: dashboard, reports, my-tickets, cc-tickets, branch,
 * region, the tickets layout and the ticket detail page. Measured against
 * live preview data on 2026-09-08: 4,189 tickets, 20,904 embedded messages,
 * 8.1 MB of JSON, 1.4 s server time — before the browser parses it and
 * rebuilds ~25k objects in the flatten step below.
 *
 * With the previous 30 s default (plus refetchOnWindowFocus) that whole cost
 * was paid again on nearly every navigation and every alt-tab back into the
 * app, which is what made the portal feel frozen on every screen rather than
 * just on the ticket list. Liveness does NOT depend on this number: Realtime
 * invalidates the query the moment a ticket actually changes
 * (use-realtime-tickets), so a longer window only removes refetches that had
 * nothing new to fetch.
 */
const TICKET_LIST_STALE_MS = 5 * 60 * 1000

// Include a slim message projection so SLA calculations can detect the
// first agent reply and switch from "first reply" to "next reply" —
// otherwise the SLA clock keeps ticking against the original post.
// The `author:profiles(role)` join lets the SLA calculator distinguish
// agent replies from end-user replies authoritatively.
// `custom_field_values` is included so the list can be searched by
// Lead/Loan Number and Borrower Name — those never appear in the
// subject, so without them a loan-number search finds nothing.
// It is a narrow projection (field id + value) over ~6k rows.
//
// Shared by the full list and by `syncTicketListChanges`, so a ticket
// fetched on its own is shaped exactly like one from the full list.
const TICKET_LIST_SELECT =
  '*, ticket_cc(user_id), ticket_collaborators(user_id), custom_field_values(field_id, value), messages(id, author_id, created_at, is_internal, is_system, author:profiles(role))'

/** Flatten join table arrays into simple user ID arrays. */
function flattenListRow(row: Record<string, unknown>): Ticket {
  const ticket = { ...row }
  ticket.cc = (row.ticket_cc as { user_id: string }[] | null)?.map((r) => r.user_id) ?? []
  ticket.collaborators = (row.ticket_collaborators as { user_id: string }[] | null)?.map((r) => r.user_id) ?? []
  ticket.messages = hydrateMessages(row.messages as Array<Record<string, unknown>> | null)
  // Same shape the detail hook produces, so search code can read
  // `custom_fields` without caring which query loaded the ticket.
  ticket.custom_fields = row.custom_field_values ?? []
  delete ticket.ticket_cc
  delete ticket.ticket_collaborators
  delete ticket.custom_field_values
  return ticket as unknown as Ticket
}

/**
 * More changed tickets than this in one go and it is cheaper to reload the
 * whole list than to merge. Measured 2026-09-25 on preview: 11 tickets
 * changed in the busiest recent hour, so this is only hit after a bulk
 * import or a long-idle tab.
 */
const CHANGES_MAX = 200

/**
 * A full list reload that was already downloading when something changed
 * carries data from BEFORE that change. Left alone, it lands a few seconds
 * later and overwrites the fresher list — a ticket just solved reappears as
 * unsolved. So cancel it (React Query restores the list it had) and let the
 * caller bring that list forward with only the changes.
 *
 * Returns false when there is no list yet and the initial load is still
 * running: that load will be current, and cancelling it would leave nothing.
 */
async function cancelStaleListReload(queryClient: QueryClient): Promise<boolean> {
  const key = ticketKeys.list({})
  if (queryClient.getQueryState(key)?.fetchStatus !== 'fetching') return true
  if (!queryClient.getQueryData(key)) return false
  await queryClient.cancelQueries({ queryKey: key, exact: true })
  return true
}

/**
 * Bring the cached shared ticket list up to date by fetching ONLY the
 * tickets changed since the newest one it already holds, and merging them in.
 *
 * This is what the freshness probe and Realtime call instead of throwing the
 * list away: the full list is ~9.6 MB (see lib/tickets/list-cache.ts), a
 * typical change set is a handful of rows. Falls back to a full reload when
 * there is nothing to measure "since" from, or when too much has changed.
 *
 * Known limit: a ticket that stops being visible to this user (RLS) is not
 * returned here, so it stays in the list until the next full load. Agents
 * and admins see every ticket (migration 017), so for them that cannot
 * happen; the list's 5-minute staleness still reloads it on navigation.
 */
export async function syncTicketListChanges(
  queryClient: QueryClient,
  getToken: (opts: { template: string }) => Promise<string | null>,
): Promise<void> {
  const key = ticketKeys.list({})
  if (!(await cancelStaleListReload(queryClient))) return
  const cached = queryClient.getQueryData<Ticket[]>(key)
  const since = cached ? latestUpdatedAt(cached) : null

  // Filtered list variants (none are used today) are cheap to reload
  // relative to guessing whether a changed ticket still matches them.
  queryClient.invalidateQueries({
    queryKey: ticketKeys.lists(),
    predicate: (q) => JSON.stringify(q.queryKey) !== JSON.stringify(key),
  })

  if (!cached || !since) {
    queryClient.invalidateQueries({ queryKey: key })
    return
  }

  const token = await getToken({ template: 'supabase' })
  if (!token) return

  const supabase = createClerkSupabaseClient(token)
  // `gte`, not `gt`: two writes can share a timestamp, and re-merging the
  // newest ticket we already have is harmless.
  const { data, error } = await supabase
    .from('tickets')
    .select(TICKET_LIST_SELECT)
    .gte('updated_at', since)
    .order('updated_at', { ascending: false })
    .limit(CHANGES_MAX + 1)

  if (error || !data) {
    // Could not ask for just the changes — fall back to the full reload
    // rather than silently staying stale.
    queryClient.invalidateQueries({ queryKey: key })
    return
  }
  if (data.length > CHANGES_MAX) {
    queryClient.invalidateQueries({ queryKey: key })
    return
  }

  const changed = (data as Record<string, unknown>[]).map(flattenListRow)
  queryClient.setQueryData<Ticket[]>(key, (current) =>
    current ? mergeChangedTickets(current, changed) : current,
  )
}

/**
 * Fetch a list of tickets with optional filters.
 */
export function useTickets(filters: TicketFilters = {}) {
  const { getToken } = useAuth()

  return useQuery<Ticket[]>({
    queryKey: ticketKeys.list(filters),
    staleTime: TICKET_LIST_STALE_MS,
    // Refetching 8.1 MB every time the window regains focus is pure cost:
    // Realtime already pushes real changes. Overrides the app-wide default
    // in components/providers.tsx for this one query only.
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const token = await getToken({ template: 'supabase' })
      if (!token) throw new Error('No auth token')

      const supabase = createClerkSupabaseClient(token)
      let query = supabase.from('tickets').select(TICKET_LIST_SELECT)

      if (filters.status) {
        query = query.eq('status', filters.status)
      }
      if (filters.priority) {
        query = query.eq('priority', filters.priority)
      }
      if (filters.category) {
        query = query.eq('category', filters.category)
      }
      if (filters.assignedTo) {
        query = query.eq('assigned_to', filters.assignedTo)
      }

      query = query.order('created_at', { ascending: false })

      const { data, error } = await query
      if (error) throw error

      return ((data ?? []) as Record<string, unknown>[]).map(flattenListRow)
    },
  })
}

/**
 * Fetch a single ticket by ID, including messages and attachments.
 */
export function useTicket(id: string | null | undefined) {
  const { getToken } = useAuth()

  return useQuery<Ticket | null>({
    queryKey: ticketKeys.detail(id!),
    queryFn: async () => {
      const token = await getToken({ template: 'supabase' })
      if (!token) throw new Error('No auth token')

      const supabase = createClerkSupabaseClient(token)
      // `parent` follows the parent_ticket_id FK outward to the parent
      // row (to-one — uses the FK column name directly so PostgREST
      // treats it as the forward reference). `follow_ups` walks back
      // through the same FK on other rows (to-many — uses the
      // `tickets!parent_ticket_id` form so PostgREST treats it as the
      // inverse). Title is included so the UI banners can show a
      // meaningful label without a second round-trip.
      const { data, error } = await supabase
        .from('tickets')
        .select(
          '*, messages(*, author:profiles(role)), attachments(*), ticket_cc(user_id), ticket_collaborators(user_id), custom_field_values(field_id, value), parent:parent_ticket_id(id, title, status), follow_ups:tickets!parent_ticket_id(id, title, status)',
        )
        .eq('id', id!)
        .single()

      if (error) throw error

      // Flatten join table arrays into simple string arrays
      const ticket = data as Record<string, unknown>
      ticket.cc = ((data as Record<string, unknown>).ticket_cc as { user_id: string }[] | null)?.map((r) => r.user_id) ?? []
      ticket.collaborators = ((data as Record<string, unknown>).ticket_collaborators as { user_id: string }[] | null)?.map((r) => r.user_id) ?? []
      ticket.custom_fields = (data as Record<string, unknown>).custom_field_values ?? []
      ticket.messages = hydrateMessages(ticket.messages as Array<Record<string, unknown>> | null)
      delete ticket.ticket_cc
      delete ticket.ticket_collaborators
      delete ticket.custom_field_values

      // Generate signed URLs for attachments (private bucket)
      const attachments = (ticket.attachments as { id: string; storage_path: string; [k: string]: unknown }[]) ?? []
      const storagePaths = attachments
        .map((att) => att.storage_path)
        .filter(Boolean)

      if (storagePaths.length > 0) {
        try {
          const res = await fetch('/api/attachments/signed-urls', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ticketId: id,
              storagePaths,
            }),
          })
          if (res.ok) {
            const { urls, downloadUrls } = await res.json()
            for (const att of attachments) {
              if (att.storage_path && urls[att.storage_path]) {
                att.url = urls[att.storage_path]
                // Separate link for the download button: same file, but the
                // browser saves it under the name the user uploaded rather
                // than the UUID-prefixed storage key.
                att.download_url =
                  downloadUrls?.[att.storage_path] ?? urls[att.storage_path]
              }
            }
          }
        } catch {
          // Signed URL generation failed — attachments will show without previews
        }
      }

      return ticket as unknown as Ticket
    },
    enabled: !!id,
  })
}

// ── Mutation payloads ───────────────────────────────────────────

export interface CreateTicketPayload {
  title: string
  description: string
  priority: TicketPriority
  category: TicketCategory | string
  ticketType?: string
  subCategory?: string
  attachments?: File[]
  cc?: string[]
  customFields?: { field_id: string; value: unknown }[]
  mailingAddress?: {
    street1: string
    street2?: string
    city: string
    state: string
    zip: string
    phone?: string
  }
  parentTicketId?: string
  requesterId?: string
}

export interface UpdateTicketPayload {
  id: string
  /** Ticket subject. Editable after creation — see the header on the detail page. */
  title?: string
  status?: TicketStatus
  priority?: TicketPriority
  category?: TicketCategory
  ticketType?: string
  subCategory?: string | null
  assignedTo?: string | null
  assignedTeam?: string | null
  internalNotes?: string
}

/**
 * Mutation hook to create a new ticket.
 */
export function useCreateTicket() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: CreateTicketPayload) => {
      // Call the server API route which handles routing rules, CC,
      // custom fields, mailing address, and parent ticket linking.
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: payload.title,
          description: payload.description,
          priority: payload.priority,
          category: payload.category,
          ticketType: payload.ticketType,
          subCategory: payload.subCategory,
          cc: payload.cc,
          customFields: payload.customFields,
          mailingAddress: payload.mailingAddress,
          parentTicketId: payload.parentTicketId,
          requesterId: payload.requesterId,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to create ticket')
      }

      const ticket = await res.json()

      // Upload attachments now that we have a ticket ID. The ticket is
      // already created at this point, so don't throw on per-file failure
      // — surface the names and let the user re-attach from the ticket
      // detail page rather than orphaning the ticket behind an error.
      if (payload.attachments && payload.attachments.length > 0) {
        const failed: string[] = []
        for (const file of payload.attachments) {
          try {
            await uploadFileDirect({ file, ticketId: ticket.id })
          } catch {
            failed.push(file.name)
          }
        }

        if (failed.length > 0) {
          toast.error(
            `Ticket created, but couldn't attach ${failed.length === 1 ? 'file' : 'files'}: ${failed.join(', ')}. Open the ticket and re-attach.`,
            { duration: 8000 },
          )
        }
      }

      return ticket as Ticket
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.lists() })
    },
  })
}

/**
 * Mutation hook to update an existing ticket.
 */
export function useUpdateTicket() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: UpdateTicketPayload) => {
      const token = await getToken({ template: 'supabase' })
      if (!token) throw new Error('No auth token')

      const supabase = createClerkSupabaseClient(token)
      const { id, ...updates } = payload

      // Convert camelCase keys to snake_case for the DB
      const dbUpdates: Record<string, unknown> = {}
      if (updates.title !== undefined) dbUpdates.title = updates.title
      if (updates.status !== undefined) dbUpdates.status = updates.status
      if (updates.priority !== undefined) dbUpdates.priority = updates.priority
      if (updates.category !== undefined) dbUpdates.category = updates.category
      if (updates.ticketType !== undefined) dbUpdates.ticket_type = updates.ticketType
      if (updates.subCategory !== undefined) dbUpdates.sub_category = updates.subCategory
      if (updates.assignedTo !== undefined) dbUpdates.assigned_to = updates.assignedTo
      if (updates.assignedTeam !== undefined) dbUpdates.assigned_team = updates.assignedTeam
      if (updates.internalNotes !== undefined) dbUpdates.internal_notes = updates.internalNotes

      const { data, error } = await supabase
        .from('tickets')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as Ticket
    },
    onSuccess: async (data) => {
      // Patch AFTER cancelling any reload already in flight — cancelling
      // restores the list as it was before that reload, which would undo a
      // patch made first.
      await cancelStaleListReload(queryClient)
      // Apply the change to the cached list straight away, from the row the
      // database just returned. This is what takes a solved ticket out of
      // the agent's view the instant they solve it: the full list reload
      // behind it is ~9.6 MB and was measured at up to 5.5 s even without
      // RLS (lib/tickets/list-cache.ts), and until it landed the solved
      // ticket sat in the view looking unsolved.
      queryClient.setQueriesData<Ticket[]>(
        { queryKey: ticketKeys.lists() },
        (list) => (list ? patchTicketInList(list, data.id, data) : list),
      )
      // Then fetch just the changed tickets to reconcile — immediately, not
      // throttled, because this is the user's own action.
      void syncTicketListChanges(queryClient, getToken)
      queryClient.invalidateQueries({ queryKey: ticketKeys.detail(data.id) })
    },
  })
}
