'use client'

import { useQuery } from '@tanstack/react-query'
import { useUser, useAuth } from '@clerk/nextjs'
import { createClerkSupabaseClient } from '@/lib/supabase/client'
import type { User } from '@/types'

function getAssumedUserId(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/(?:^|;\s*)assumed-user-id=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : null
}

/**
 * Combines Clerk's useUser() with a Supabase profile query.
 * If an "assumed-user-id" cookie is set (admin feature), returns
 * that user's profile instead so the admin can view the app from
 * another user's perspective.
 */
export function useCurrentUser() {
  const { user, isLoaded: isClerkLoaded } = useUser()
  const { getToken } = useAuth()

  const assumedUserId = getAssumedUserId()

  // Fetch the real user's profile (always, for admin check)
  const {
    data: realProfile,
    isLoading: isRealProfileLoading,
  } = useQuery<User | null>({
    queryKey: ['currentUserProfile', user?.id],
    queryFn: async () => {
      const token = await getToken({ template: 'supabase' })
      if (!token) return null

      const supabase = createClerkSupabaseClient(token)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user!.id)
        .single()

      if (error) throw error
      return data as User
    },
    enabled: isClerkLoaded && !!user,
  })

  // Fetch assumed user's profile (only when assuming)
  const {
    data: assumedProfile,
    isLoading: isAssumedProfileLoading,
  } = useQuery<User | null>({
    queryKey: ['assumedUserProfile', assumedUserId],
    queryFn: async () => {
      if (!assumedUserId) return null
      const token = await getToken({ template: 'supabase' })
      if (!token) return null

      const supabase = createClerkSupabaseClient(token)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', assumedUserId)
        .single()

      if (error) throw error
      return data as User
    },
    enabled: isClerkLoaded && !!user && !!assumedUserId,
  })

  const isLoading = !isClerkLoaded || isRealProfileLoading || (!!assumedUserId && isAssumedProfileLoading)

  // If assuming, use the assumed profile for the UI but keep real profile accessible
  const isAssuming = !!assumedUserId && !!assumedProfile
  const profile = isAssuming ? assumedProfile : (realProfile ?? null)

  return {
    /** The Clerk user object (always the real admin) */
    user,
    /** Profile used for the UI — either assumed user or real user */
    profile: profile ?? null,
    /** The real admin profile (when assuming, this is the actual logged-in user) */
    realProfile: realProfile ?? null,
    /** Whether we're currently assuming another user */
    isAssuming,
    isLoading,
    isEmployee: profile?.role === 'employee',
    isAgent: profile?.role === 'agent',
    isAdmin: profile?.role === 'admin',
    /** The real user is always an admin if assuming (only admins can assume) */
    isRealAdmin: realProfile?.role === 'admin',
  }
}
