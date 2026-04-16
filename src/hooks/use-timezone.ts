'use client'

import { useCurrentUser } from './use-current-user'
import { formatDateTime, formatDate, formatTime, formatRelative } from '@/lib/format-date'

/**
 * Returns formatting functions that use the current user's timezone.
 * Falls back to America/Chicago if no timezone is set.
 */
export function useTimezone() {
  const { profile } = useCurrentUser()
  const tz = profile?.timezone ?? 'America/Chicago'

  return {
    timezone: tz,
    formatDateTime: (date: string | Date) => formatDateTime(date, tz),
    formatDate: (date: string | Date) => formatDate(date, tz),
    formatTime: (date: string | Date) => formatTime(date, tz),
    formatRelative,
  }
}
