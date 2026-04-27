"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { X, Ticket as TicketIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTabStore } from "@/stores/tab-store"

const TICKET_PATH_RE = /^\/tickets\/(T-[^/]+)\/?$/

function getActiveTicketId(pathname: string): string | null {
  const match = pathname.match(TICKET_PATH_RE)
  return match ? match[1] : null
}

export function TicketTabs() {
  const pathname = usePathname()
  const router = useRouter()
  const tabs = useTabStore((s) => s.tabs)
  const closeTab = useTabStore((s) => s.closeTab)

  // Defer rendering until after client hydration so persisted tabs don't
  // diverge from the server-rendered (empty) state.
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  const activeId = getActiveTicketId(pathname ?? "")

  if (!mounted || tabs.length === 0) return null

  const handleClose = (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    const isActive = id === activeId
    const next = closeTab(id)
    if (isActive) {
      router.push(next ? `/tickets/${next}` : "/tickets")
    }
  }

  return (
    <div className="hidden md:flex h-9 items-stretch gap-0.5 border-b border-gray-200 bg-gray-100 px-2 overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = tab.id === activeId
        return (
          <Link
            key={tab.id}
            href={`/tickets/${tab.id}`}
            className={cn(
              "group flex items-center gap-1.5 px-3 text-xs border-l border-r border-transparent max-w-[220px] min-w-0 -mb-px",
              isActive
                ? "bg-white border-gray-200 border-b-white text-gray-900 font-medium rounded-t-md"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/60 rounded-t-md",
            )}
            title={
              tab.requesterName
                ? `${tab.id} · ${tab.requesterName} — ${tab.title}`
                : `${tab.id} — ${tab.title}`
            }
          >
            <TicketIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="truncate">
              <span className="text-muted-foreground mr-1">{tab.id}</span>
              {tab.title}
            </span>
            <button
              type="button"
              onClick={(e) => handleClose(e, tab.id)}
              aria-label={`Close ${tab.id}`}
              className={cn(
                "ml-1 rounded-sm p-0.5 shrink-0 text-gray-400",
                isActive
                  ? "hover:bg-gray-200 hover:text-gray-700"
                  : "hover:bg-gray-300/60 hover:text-gray-700 opacity-0 group-hover:opacity-100",
              )}
            >
              <X className="h-3 w-3" />
            </button>
          </Link>
        )
      })}
    </div>
  )
}
