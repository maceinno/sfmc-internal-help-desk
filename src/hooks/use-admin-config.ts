'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { createClerkSupabaseClient } from '@/lib/supabase/client'
import type {
  SlaPolicy,
  ViewConfig,
  CannedResponse,
  RoutingRule,
  CustomField,
  DepartmentSchedule,
  Branch,
  Region,
} from '@/types'

// ── Helpers ─────────────────────────────────────────────────────

function useSupabaseQuery<T>(
  key: string[],
  table: string,
  options?: {
    orderBy?: string
    ascending?: boolean
    enabled?: boolean
  },
) {
  const { getToken } = useAuth()

  return useQuery<T[]>({
    queryKey: key,
    queryFn: async () => {
      const token = await getToken({ template: 'supabase' })
      if (!token) throw new Error('No auth token')

      const supabase = createClerkSupabaseClient(token)
      let query = supabase.from(table).select('*')

      if (options?.orderBy) {
        query = query.order(options.orderBy, {
          ascending: options.ascending ?? true,
        })
      }

      const { data, error } = await query
      if (error) throw error
      return data as T[]
    },
    enabled: options?.enabled ?? true,
  })
}

// ── SLA Policies ────────────────────────────────────────────────

export function useSlaPolicies() {
  return useSupabaseQuery<SlaPolicy>(
    ['admin', 'slaPolicies'],
    'sla_policies',
    { orderBy: 'sort_order', ascending: true },
  )
}

// ── View Configs ────────────────────────────────────────────────

export function useViewConfigs() {
  return useSupabaseQuery<ViewConfig>(
    ['admin', 'viewConfigs'],
    'view_configs',
    { orderBy: 'sort_order', ascending: true },
  )
}

// ── Canned Responses ────────────────────────────────────────────

export function useCannedResponses() {
  return useSupabaseQuery<CannedResponse>(
    ['admin', 'cannedResponses'],
    'canned_responses',
    { orderBy: 'name', ascending: true },
  )
}

// ── Routing Rules ───────────────────────────────────────────────

export function useRoutingRules() {
  return useSupabaseQuery<RoutingRule>(
    ['admin', 'routingRules'],
    'routing_rules',
    { orderBy: 'priority_order', ascending: true },
  )
}

// ── Custom Fields ───────────────────────────────────────────────

export function useCustomFields() {
  return useSupabaseQuery<CustomField>(
    ['admin', 'customFields'],
    'custom_fields',
    { orderBy: 'sort_order', ascending: true },
  )
}

// ── Department Categories ───────────────────────────────────────

export interface DepartmentCategory {
  name: string
  subCategories?: string[]
}

export interface DepartmentCategoryGroup {
  ticket_type: string
  categories: DepartmentCategory[]
}

interface DbDepartmentCategoryRow {
  id: string
  ticket_type: string
  category_name: string
  sub_categories: string[] | null
  sort_order: number | null
}

/**
 * Returns admin-managed departments and categories, grouped by department
 * name. Drives the Create Ticket form, SLA policies, routing rules, etc.,
 * so everything reads from the same source of truth.
 */
export function useDepartmentCategories() {
  const { getToken } = useAuth()

  return useQuery<DepartmentCategoryGroup[]>({
    queryKey: ['admin', 'departmentCategories'],
    queryFn: async () => {
      const token = await getToken({ template: 'supabase' })
      if (!token) throw new Error('No auth token')

      const supabase = createClerkSupabaseClient(token)
      const { data, error } = await supabase
        .from('department_categories')
        .select('*')
        .order('ticket_type', { ascending: true })
        .order('sort_order', { ascending: true })
      if (error) throw error

      const grouped = new Map<string, DepartmentCategory[]>()
      for (const row of (data ?? []) as DbDepartmentCategoryRow[]) {
        if (!grouped.has(row.ticket_type)) grouped.set(row.ticket_type, [])
        grouped.get(row.ticket_type)!.push({
          name: row.category_name,
          subCategories: row.sub_categories?.length
            ? row.sub_categories
            : undefined,
        })
      }

      return Array.from(grouped.entries()).map(([ticket_type, categories]) => ({
        ticket_type,
        categories,
      }))
    },
  })
}

// ── Department Schedules ────────────────────────────────────────

export function useDepartmentSchedules() {
  return useSupabaseQuery<DepartmentSchedule>(
    ['admin', 'departmentSchedules'],
    'department_schedules',
    { orderBy: 'department_name', ascending: true },
  )
}

// ── Branding ────────────────────────────────────────────────────

export interface BrandingConfig {
  id: string
  logoUrl?: string
  primaryColor?: string
  companyName?: string
  [key: string]: unknown
}

export function useBranding() {
  const { getToken } = useAuth()

  return useQuery<BrandingConfig | null>({
    queryKey: ['admin', 'branding'],
    queryFn: async () => {
      const token = await getToken({ template: 'supabase' })
      if (!token) throw new Error('No auth token')

      const supabase = createClerkSupabaseClient(token)
      const { data, error } = await supabase
        .from('branding_config')
        .select('*')
        .limit(1)
        .single()

      if (error) {
        // No branding row yet is a valid state
        if (error.code === 'PGRST116') return null
        throw error
      }
      return data as BrandingConfig
    },
  })
}

// ── Branches ────────────────────────────────────────────────────

export function useBranches() {
  return useSupabaseQuery<Branch>(
    ['admin', 'branches'],
    'branches',
    { orderBy: 'name', ascending: true },
  )
}

// ── Regions ─────────────────────────────────────────────────────

export function useRegions() {
  return useSupabaseQuery<Region>(
    ['admin', 'regions'],
    'regions',
    { orderBy: 'name', ascending: true },
  )
}

// ── Teams ───────────────────────────────────────────────────────

export interface Team {
  id: string
  name: string
  description?: string
  [key: string]: unknown
}

export function useTeams() {
  return useSupabaseQuery<Team>(
    ['admin', 'teams'],
    'teams',
    { orderBy: 'name', ascending: true },
  )
}
