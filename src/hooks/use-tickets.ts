'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { createClerkSupabaseClient } from '@/lib/supabase/client'
import type {
  Ticket,
  TicketStatus,
  TicketPriority,
  TicketCategory,
} from '@/types'

// ── Query keys ──────────────────────────────────────────────────

const ticketKeys = {
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
 * Fetch a list of tickets with optional filters.
 */
export function useTickets(filters: TicketFilters = {}) {
  const { getToken } = useAuth()

  return useQuery<Ticket[]>({
    queryKey: ticketKeys.list(filters),
    queryFn: async () => {
      const token = await getToken({ template: 'supabase' })
      if (!token) throw new Error('No auth token')

      const supabase = createClerkSupabaseClient(token)
      let query = supabase.from('tickets').select('*, ticket_cc(user_id), ticket_collaborators(user_id)')

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

      // Flatten join table arrays into simple user ID arrays
      return (data ?? []).map((row: Record<string, unknown>) => {
        const ticket = { ...row }
        ticket.cc = (row.ticket_cc as { user_id: string }[] | null)?.map((r) => r.user_id) ?? []
        ticket.collaborators = (row.ticket_collaborators as { user_id: string }[] | null)?.map((r) => r.user_id) ?? []
        delete ticket.ticket_cc
        delete ticket.ticket_collaborators
        return ticket as unknown as Ticket
      })
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
      const { data, error } = await supabase
        .from('tickets')
        .select('*, messages(*), attachments(*), ticket_cc(user_id), ticket_collaborators(user_id), custom_field_values(field_id, value)')
        .eq('id', id!)
        .single()

      if (error) throw error

      // Flatten join table arrays into simple string arrays
      const ticket = data as Record<string, unknown>
      ticket.cc = ((data as Record<string, unknown>).ticket_cc as { user_id: string }[] | null)?.map((r) => r.user_id) ?? []
      ticket.collaborators = ((data as Record<string, unknown>).ticket_collaborators as { user_id: string }[] | null)?.map((r) => r.user_id) ?? []
      ticket.custom_fields = (data as Record<string, unknown>).custom_field_values ?? []
      delete ticket.ticket_cc
      delete ticket.ticket_collaborators
      delete ticket.custom_field_values

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
  category: TicketCategory
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
  }
  parentTicketId?: string
}

export interface UpdateTicketPayload {
  id: string
  status?: TicketStatus
  priority?: TicketPriority
  category?: TicketCategory
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
      // Upload attachments first
      const attachmentIds: string[] = []
      if (payload.attachments && payload.attachments.length > 0) {
        for (const file of payload.attachments) {
          const formData = new FormData()
          formData.append('file', file)
          // We'll link them after ticket creation; use a temp ticketId
          // Actually the upload API requires a ticketId, so we'll upload
          // after ticket creation. For now, skip — the API route doesn't
          // handle file uploads inline. We'll handle this post-creation.
        }
      }

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
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to create ticket')
      }

      const ticket = await res.json()

      // Upload attachments now that we have a ticket ID
      if (payload.attachments && payload.attachments.length > 0) {
        for (const file of payload.attachments) {
          const formData = new FormData()
          formData.append('file', file)
          formData.append('ticketId', ticket.id)
          await fetch('/api/upload', { method: 'POST', body: formData })
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
      if (updates.status !== undefined) dbUpdates.status = updates.status
      if (updates.priority !== undefined) dbUpdates.priority = updates.priority
      if (updates.category !== undefined) dbUpdates.category = updates.category
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.lists() })
      queryClient.invalidateQueries({ queryKey: ticketKeys.detail(data.id) })
    },
  })
}
