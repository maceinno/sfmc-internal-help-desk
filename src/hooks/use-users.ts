'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { createClerkSupabaseClient } from '@/lib/supabase/client'
import type { User } from '@/types'

/**
 * Fetch all users from Supabase for user-selection UIs (CC, assignment, etc.).
 */
export function useUsers() {
  const { getToken } = useAuth()

  return useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const token = await getToken({ template: 'supabase' })
      if (!token) throw new Error('No auth token')

      const supabase = createClerkSupabaseClient(token)
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      return data as User[]
    },
  })
}
