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
      let query = supabase.from('tickets').select('*')

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
      return data as Ticket[]
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
        .select('*, messages(*), attachments(*), ticket_cc(user_id), ticket_collaborators(user_id)')
        .eq('id', id!)
        .single()

      if (error) throw error

      // Flatten join table arrays into simple string arrays
      const ticket = data as Record<string, unknown>
      ticket.cc = ((data as Record<string, unknown>).ticket_cc as { user_id: string }[] | null)?.map((r) => r.user_id) ?? []
      ticket.collaborators = ((data as Record<string, unknown>).ticket_collaborators as { user_id: string }[] | null)?.map((r) => r.user_id) ?? []
      delete ticket.ticket_cc
      delete ticket.ticket_collaborators

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
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: CreateTicketPayload) => {
      const token = await getToken({ template: 'supabase' })
      if (!token) throw new Error('No auth token')

      const supabase = createClerkSupabaseClient(token)
      const { data, error } = await supabase
        .from('tickets')
        .insert({
          title: payload.title,
          description: payload.description,
          priority: payload.priority,
          category: payload.category,
          ticket_type: payload.ticketType,
          sub_category: payload.subCategory,
        })
        .select()
        .single()

      if (error) throw error
      return data as Ticket
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
