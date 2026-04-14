'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth, useUser } from '@clerk/nextjs'
import { createClerkSupabaseClient } from '@/lib/supabase/client'
import type { AppNotification } from '@/types'

const notificationKeys = {
  all: ['notifications'] as const,
  list: (userId: string) => [...notificationKeys.all, userId] as const,
}

/**
 * Fetch all notifications for the current user, newest first.
 */
export function useNotifications() {
  const { getToken } = useAuth()
  const { user } = useUser()

  return useQuery<AppNotification[]>({
    queryKey: notificationKeys.list(user?.id ?? ''),
    queryFn: async () => {
      const token = await getToken({ template: 'supabase' })
      if (!token) throw new Error('No auth token')

      const supabase = createClerkSupabaseClient(token)
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('to_user_id', user!.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as AppNotification[]
    },
    enabled: !!user?.id,
  })
}

/**
 * Mark a single notification as read.
 */
export function useMarkNotificationRead() {
  const { getToken } = useAuth()
  const { user } = useUser()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const token = await getToken({ template: 'supabase' })
      if (!token) throw new Error('No auth token')

      const supabase = createClerkSupabaseClient(token)
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)

      if (error) throw error
    },
    onSuccess: () => {
      if (user?.id) {
        queryClient.invalidateQueries({
          queryKey: notificationKeys.list(user.id),
        })
      }
    },
  })
}

/**
 * Mark all notifications for the current user as read.
 */
export function useMarkAllNotificationsRead() {
  const { getToken } = useAuth()
  const { user } = useUser()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const token = await getToken({ template: 'supabase' })
      if (!token) throw new Error('No auth token')
      if (!user?.id) throw new Error('No user')

      const supabase = createClerkSupabaseClient(token)
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('to_user_id', user.id)
        .eq('read', false)

      if (error) throw error
    },
    onSuccess: () => {
      if (user?.id) {
        queryClient.invalidateQueries({
          queryKey: notificationKeys.list(user.id),
        })
      }
    },
  })
}
