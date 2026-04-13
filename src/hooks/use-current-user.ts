'use client'

import { useQuery } from '@tanstack/react-query'
import { useUser, useAuth } from '@clerk/nextjs'
import { createClerkSupabaseClient } from '@/lib/supabase/client'
import type { User } from '@/types'

/**
 * Combines Clerk's useUser() with a Supabase profile query.
 * Returns the Clerk user, the full Supabase profile, role helpers, and loading state.
 */
export function useCurrentUser() {
  const { user, isLoaded: isClerkLoaded } = useUser()
  const { getToken } = useAuth()

  const {
    data: profile,
    isLoading: isProfileLoading,
  } = useQuery<User | null>({
    queryKey: ['currentUserProfile', user?.id],
    queryFn: async () => {
      const token = await getToken({ template: 'supabase' })
      if (!token) return null

      const supabase = createClerkSupabaseClient(token)
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user!.id)
        .single()

      if (error) throw error
      return data as User
    },
    enabled: isClerkLoaded && !!user,
  })

  const isLoading = !isClerkLoaded || isProfileLoading

  return {
    /** The Clerk user object */
    user,
    /** Full profile from Supabase (includes role, department, etc.) */
    profile: profile ?? null,
    isLoading,
    isEmployee: profile?.role === 'employee',
    isAgent: profile?.role === 'agent',
    isAdmin: profile?.role === 'admin',
  }
}
