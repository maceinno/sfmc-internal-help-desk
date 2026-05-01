'use client'

import { Eye } from 'lucide-react'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { PresenceUser } from '@/hooks/use-ticket-presence'

// ── Props ──────────────────────────────────────────────────────

interface PresenceIndicatorProps {
  viewers: PresenceUser[]
  className?: string
}

// ── Component ──────────────────────────────────────────────────

/**
 * Shows which other agents/admins are currently viewing the same ticket.
 *
 * - Hidden when no other viewers are present
 * - Eye icon with a count badge when 1+ viewers
 * - Tooltip lists viewer names (with "is typing…" annotation)
 * - Small avatar stack (max 3, +N overflow)
 */
export function PresenceIndicator({ viewers, className }: PresenceIndicatorProps) {
  if (viewers.length === 0) return null

  const maxAvatars = 3
  const shown = viewers.slice(0, maxAvatars)
  const overflow = viewers.length - maxAvatars

  const typingViewers = viewers.filter((v) => v.isTyping)

  return (
    <Tooltip>
      <TooltipTrigger
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100',
          className,
        )}
      >
        {/* Avatar stack */}
        <div className="flex -space-x-1.5">
          {shown.map((viewer) => (
            <span
              key={viewer.userId}
              className="relative inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-blue-50 bg-blue-200 text-[10px] font-semibold text-blue-800"
              title={viewer.name}
            >
              {viewer.avatarUrl ? (
                <img
                  src={viewer.avatarUrl}
                  alt={viewer.name}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                viewer.name.charAt(0).toUpperCase()
              )}
              {/* Typing pulse dot */}
              {viewer.isTyping && (
                <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-blue-50 bg-green-500 animate-pulse" />
              )}
            </span>
          ))}
          {overflow > 0 && (
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-blue-50 bg-blue-300 text-[9px] font-bold text-blue-900">
              +{overflow}
            </span>
          )}
        </div>

        {/* Eye icon + count */}
        <Eye className="h-3.5 w-3.5" />
        <span>{viewers.length}</span>
      </TooltipTrigger>

      <TooltipContent side="bottom" className="max-w-xs">
        <div className="space-y-0.5">
          <p className="font-medium">Also viewing this ticket:</p>
          {viewers.map((v) => (
            <p key={v.userId} className="text-xs">
              {v.name}
              {v.isTyping && (
                <span className="ml-1 text-green-400">is typing…</span>
              )}
            </p>
          ))}
        </div>
      </TooltipContent>

      {/* Typing indicator text below the badge */}
      {typingViewers.length > 0 && (
        <span className="ml-1 text-xs text-green-600 animate-pulse">
          {typingViewers.length === 1
            ? `${typingViewers[0].name} is typing…`
            : `${typingViewers.length} agents typing…`}
        </span>
      )}
    </Tooltip>
  )
}
