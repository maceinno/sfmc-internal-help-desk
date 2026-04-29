"use client"

import * as React from "react"
import { GitMerge, Search, AlertTriangle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/tickets/status-badge"
import { PriorityBadge } from "@/components/tickets/priority-badge"
import { useTimezone } from "@/hooks/use-timezone"
import type { Ticket } from "@/types"

interface MergeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentTicket: Ticket
  allTickets: Ticket[]
  onConfirm: (targetTicket: Ticket, direction: "into" | "from") => void
}

export function MergeModal({
  open,
  onOpenChange,
  currentTicket,
  allTickets,
  onConfirm,
}: MergeModalProps) {
  const { formatDateTime } = useTimezone()
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedTicket, setSelectedTicket] = React.useState<Ticket | null>(
    null
  )
  const [direction, setDirection] = React.useState<"into" | "from">("into")

  const searchResults = React.useMemo(() => {
    if (!searchQuery.trim()) return []

    const query = searchQuery.toLowerCase()
    return allTickets
      .filter((t) => {
        if (t.id === currentTicket.id) return false
        if (t.merged_into_id) return false
        return (
          t.id.toLowerCase().includes(query) ||
          t.title.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query)
        )
      })
      .slice(0, 8)
  }, [searchQuery, allTickets, currentTicket.id])

  const handleConfirm = () => {
    if (!selectedTicket) return
    onConfirm(selectedTicket, direction)
    handleClose()
  }

  const handleClose = () => {
    setSearchQuery("")
    setSelectedTicket(null)
    setDirection("into")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5 text-purple-600" />
            Merge Tickets
          </DialogTitle>
          <DialogDescription>
            Search for a ticket to merge with #{currentTicket.id}. All
            messages will be combined into the primary ticket.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setSelectedTicket(null)
              }}
              placeholder="Search by ticket ID or title..."
              className="pl-9"
            />
          </div>

          {/* Search Results */}
          {searchQuery && !selectedTicket && (
            <div className="max-h-60 overflow-y-auto rounded-lg border">
              {searchResults.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No matching tickets found
                </div>
              ) : (
                <div className="divide-y">
                  {searchResults.map((ticket) => (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => setSelectedTicket(ticket)}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">
                            #{ticket.id}
                          </span>
                          <StatusBadge status={ticket.status} />
                          <PriorityBadge priority={ticket.priority} />
                        </div>
                        <p className="mt-0.5 truncate text-sm text-gray-600">
                          {ticket.title}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Selected ticket preview */}
          {selectedTicket && (
            <div className="space-y-3">
              <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-sm font-semibold text-purple-900">
                    #{selectedTicket.id}
                  </span>
                  <StatusBadge status={selectedTicket.status} />
                  <PriorityBadge priority={selectedTicket.priority} />
                </div>
                <p className="text-sm font-medium text-purple-800">
                  {selectedTicket.title}
                </p>
                <p className="mt-1 text-xs text-purple-600">
                  {(selectedTicket.messages ?? []).length} message
                  {(selectedTicket.messages ?? []).length !== 1 ? "s" : ""} &bull;
                  Created{" "}
                  {formatDateTime(selectedTicket.created_at)}
                </p>
              </div>

              {/* Merge Direction */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">
                  Merge direction
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDirection("into")}
                    className={`flex-1 rounded-lg border p-3 text-left text-sm transition-colors ${
                      direction === "into"
                        ? "border-purple-300 bg-purple-50 text-purple-900"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <span className="font-medium">
                      Merge #{currentTicket.id} into #{selectedTicket.id}
                    </span>
                    <p className="mt-0.5 text-xs opacity-75">
                      Current ticket will be closed
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirection("from")}
                    className={`flex-1 rounded-lg border p-3 text-left text-sm transition-colors ${
                      direction === "from"
                        ? "border-purple-300 bg-purple-50 text-purple-900"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <span className="font-medium">
                      Merge #{selectedTicket.id} into #{currentTicket.id}
                    </span>
                    <p className="mt-0.5 text-xs opacity-75">
                      Selected ticket will be closed
                    </p>
                  </button>
                </div>
              </div>

              {/* Warning */}
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <p className="text-xs text-amber-800">
                  This action cannot be undone. All messages from the secondary
                  ticket will be copied to the primary ticket, and the secondary
                  ticket will be marked as solved.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedTicket}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <GitMerge className="mr-2 h-4 w-4" />
            Merge Tickets
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
