/**
 * Format a date/timestamp for display in the user's timezone.
 */

const DEFAULT_TZ = 'America/Chicago'

export function formatDateTime(
  date: string | Date,
  timezone?: string,
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('en-US', {
    timeZone: timezone || DEFAULT_TZ,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatDate(
  date: string | Date,
  timezone?: string,
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    timeZone: timezone || DEFAULT_TZ,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatTime(
  date: string | Date,
  timezone?: string,
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleTimeString('en-US', {
    timeZone: timezone || DEFAULT_TZ,
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatRelative(
  date: string | Date,
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = Date.now()
  const diffMs = now - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(d)
}
