"use client"

import * as React from "react"
import {
  Search,
  ChevronRight,
  ChevronDown,
  Zap,
  Users,
  AlertCircle,
  FileText,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import type { CannedResponse } from "@/types"

interface CannedResponsePickerProps {
  responses: CannedResponse[]
  onSelect: (response: CannedResponse) => void
  onClose: () => void
}

export function CannedResponsePicker({
  responses,
  onSelect,
  onClose,
}: CannedResponsePickerProps) {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [expandedCategories, setExpandedCategories] = React.useState<
    Record<string, boolean>
  >({})
  const searchInputRef = React.useRef<HTMLInputElement>(null)

  // Filter responses by search query
  const filteredResponses = React.useMemo(
    () =>
      responses.filter(
        (r) =>
          r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (r.category &&
            r.category.toLowerCase().includes(searchQuery.toLowerCase()))
      ),
    [responses, searchQuery]
  )

  // Group by category
  const groupedResponses = React.useMemo(() => {
    const groups: Record<string, CannedResponse[]> = {}
    for (const response of filteredResponses) {
      const category = response.category || "Uncategorized"
      if (!groups[category]) groups[category] = []
      groups[category].push(response)
    }
    return groups
  }, [filteredResponses])

  // Sort categories with Uncategorized last
  const sortedCategories = React.useMemo(
    () =>
      Object.keys(groupedResponses).sort((a, b) => {
        if (a === "Uncategorized") return 1
        if (b === "Uncategorized") return -1
        return a.localeCompare(b)
      }),
    [groupedResponses]
  )

  // Expand all categories when searching, otherwise expand first by default
  React.useEffect(() => {
    if (searchQuery) {
      const allExpanded: Record<string, boolean> = {}
      for (const cat of sortedCategories) {
        allExpanded[cat] = true
      }
      setExpandedCategories(allExpanded)
    } else if (
      sortedCategories.length > 0 &&
      Object.keys(expandedCategories).length === 0
    ) {
      setExpandedCategories({ [sortedCategories[0]]: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, sortedCategories.length])

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }))
  }

  const handleSelect = (response: CannedResponse) => {
    onSelect(response)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-0">
          <DialogTitle>Insert Template</DialogTitle>
          <DialogDescription>
            Choose a canned response to insert into your reply.
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="px-4 py-3 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates..."
              className="pl-9"
            />
          </div>
        </div>

        {/* Response list */}
        <div className="max-h-[360px] overflow-y-auto p-2">
          {sortedCategories.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No templates found matching &ldquo;{searchQuery}&rdquo;
            </div>
          ) : (
            <div className="space-y-1">
              {sortedCategories.map((category) => (
                <div key={category}>
                  {/* Category header */}
                  <button
                    type="button"
                    onClick={() => toggleCategory(category)}
                    className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {expandedCategories[category] ? (
                      <ChevronDown className="size-3.5" />
                    ) : (
                      <ChevronRight className="size-3.5" />
                    )}
                    {category}
                    <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-normal">
                      {groupedResponses[category].length}
                    </span>
                  </button>

                  {/* Responses in category */}
                  {expandedCategories[category] && (
                    <div className="space-y-0.5 pl-1">
                      {groupedResponses[category].map((response) => (
                        <button
                          key={response.id}
                          type="button"
                          onClick={() => handleSelect(response)}
                          className="group w-full rounded-lg border border-transparent px-3 py-2.5 text-left transition-all hover:border-primary/20 hover:bg-primary/5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-medium text-foreground group-hover:text-primary">
                              {response.name}
                            </span>
                            {response.usageCount !== undefined && (
                              <span className="shrink-0 text-[10px] text-muted-foreground">
                                Used {response.usageCount}x
                              </span>
                            )}
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            {response.content}
                          </p>
                          <ActionBadges actions={response.actions} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Action badges sub-component ──────────────────────────────────

function ActionBadges({
  actions,
}: {
  actions?: CannedResponse["actions"]
}) {
  if (!actions) return null

  const items: { key: string; icon: React.ElementType; label: string; className: string }[] =
    []

  if (actions.setStatus) {
    items.push({
      key: "status",
      icon: Zap,
      label: `\u2192 ${capitalize(actions.setStatus)}`,
      className:
        "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
    })
  }

  if (actions.setPriority) {
    items.push({
      key: "priority",
      icon: AlertCircle,
      label: `\u2192 ${capitalize(actions.setPriority)}`,
      className:
        "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
    })
  }

  if (actions.setTeam) {
    items.push({
      key: "team",
      icon: Users,
      label: `\u2192 ${actions.setTeam}`,
      className:
        "bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
    })
  }

  if (actions.addInternalNote) {
    items.push({
      key: "note",
      icon: FileText,
      label: "Adds Note",
      className:
        "bg-yellow-50 text-yellow-700 border-yellow-100 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800",
    })
  }

  if (items.length === 0) return null

  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {items.map(({ key, icon: Icon, label, className }) => (
        <span
          key={key}
          className={cn(
            "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium",
            className
          )}
        >
          <Icon className="size-3" />
          {label}
        </span>
      ))}
    </div>
  )
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
