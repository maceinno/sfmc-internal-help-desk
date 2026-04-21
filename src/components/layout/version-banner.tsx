'use client'

import * as React from 'react'
import { RefreshCw } from 'lucide-react'

const POLL_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Polls /api/version and prompts the user to refresh when a new deploy is
 * detected. The "loaded" version is whatever the endpoint returned on the
 * first successful fetch; subsequent fetches compare against that.
 *
 * Never shows during the initial fetch (loaded === deployed), and never
 * shows in local dev (both return `dev`).
 */
export function VersionBanner() {
  const [loadedVersion, setLoadedVersion] = React.useState<string | null>(null)
  const [deployedVersion, setDeployedVersion] = React.useState<string | null>(
    null,
  )

  React.useEffect(() => {
    let cancelled = false

    const check = async () => {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as { version?: string }
        const version = data.version
        if (!version || cancelled) return
        setLoadedVersion((prev) => prev ?? version)
        setDeployedVersion(version)
      } catch {
        // Network blips are expected; just try again on the next tick.
      }
    }

    check()
    const interval = setInterval(check, POLL_INTERVAL_MS)
    // Re-check when the tab regains focus so a user returning from a long
    // idle period is prompted promptly.
    const onFocus = () => check()
    window.addEventListener('focus', onFocus)

    return () => {
      cancelled = true
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  const hasUpdate =
    loadedVersion !== null &&
    deployedVersion !== null &&
    loadedVersion !== deployedVersion

  if (!hasUpdate) return null

  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm">
      <RefreshCw className="h-4 w-4" />
      <span>A new version of the help desk is available.</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="ml-2 inline-flex items-center gap-1.5 rounded-md bg-white/15 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/30 transition-colors hover:bg-white/25"
      >
        Refresh now
      </button>
    </div>
  )
}
