"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import type { Ticket, TicketStatus, User } from "@/types/ticket"

const STATUS_DOT: Record<TicketStatus, string> = {
  new: "bg-yellow-500",
  open: "bg-red-500",
  pending: "bg-blue-500",
  on_hold: "bg-gray-700",
  solved: "bg-gray-400",
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return "just now"
  const m = Math.floor(ms / 60_000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo}mo`
  return `${Math.floor(mo / 12)}y`
}

interface TicketQueueListProps {
  tickets: Ticket[]
  users: User[]
  title: string
}

export function TicketQueueList({
  tickets,
  users,
  title,
}: TicketQueueListProps) {
  const pathname = usePathname() ?? ""
  const userById = React.useMemo(() => {
    const map = new Map<string, User>()
    for (const u of users) map.set(u.id, u)
    return map
  }, [users])

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      <div className="flex-shrink-0 px-3 py-2 border-b border-gray-100 bg-gray-50/60">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider truncate">
          {title}
        </h2>
        <p className="text-[11px] text-gray-400 mt-0.5">
          {tickets.length} ticket{tickets.length === 1 ? "" : "s"}
        </p>
      </div>
      <ul className="flex-1 overflow-y-auto">
        {tickets.length === 0 ? (
          <li className="px-3 py-6 text-xs text-muted-foreground text-center">
            No tickets in this view.
          </li>
        ) : (
          tickets.map((t) => {
            const isActive = pathname === `/tickets/${t.id}`
            const requester = userById.get(t.created_by)
            return (
              <li key={t.id}>
                <Link
                  href={`/tickets/${t.id}`}
                  className={cn(
                    "block border-l-2 px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-blue-50 border-blue-600"
                      : "border-transparent hover:bg-gray-50",
                  )}
                  title={`${t.id} — ${t.title}`}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={cn(
                        "mt-1.5 h-2 w-2 rounded-full shrink-0",
                        STATUS_DOT[t.status],
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[11px] font-mono text-gray-500">
                          {t.id}
                        </span>
                        <span className="text-[11px] text-gray-400 shrink-0">
                          {timeAgo(t.created_at)}
                        </span>
                      </div>
                      <p
                        className={cn(
                          "line-clamp-2 leading-snug",
                          isActive
                            ? "text-blue-900 font-medium"
                            : "text-gray-900",
                        )}
                      >
                        {t.title}
                      </p>
                      {requester && (
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {requester.name}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}
