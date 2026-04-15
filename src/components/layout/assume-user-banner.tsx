'use client'

import { useState } from 'react'
import { Eye, X, Shield } from 'lucide-react'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export function AssumeUserBanner() {
  const { isAssuming, profile, realProfile } = useCurrentUser()
  const queryClient = useQueryClient()
  const [exiting, setExiting] = useState(false)

  if (!isAssuming || !profile || !realProfile) return null

  const handleExit = async () => {
    setExiting(true)
    try {
      await fetch('/api/users/assume', { method: 'DELETE' })
      // Invalidate all queries to refresh with real user
      queryClient.invalidateQueries()
      // Force reload to clear all client state
      window.location.reload()
    } catch {
      toast.error('Failed to exit assumed user mode')
      setExiting(false)
    }
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-center gap-3 text-sm font-medium shadow-md">
      <Eye className="w-4 h-4 flex-shrink-0" />
      <span>
        Viewing as <strong>{profile.name}</strong> ({profile.role})
      </span>
      <span className="text-amber-800">|</span>
      <span className="flex items-center gap-1 text-amber-800">
        <Shield className="w-3.5 h-3.5" />
        Logged in as {realProfile.name}
      </span>
      <button
        onClick={handleExit}
        disabled={exiting}
        className="ml-2 flex items-center gap-1 rounded-md bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
      >
        <X className="w-3.5 h-3.5" />
        {exiting ? 'Exiting...' : 'Exit'}
      </button>
    </div>
  )
}
