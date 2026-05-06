"use client"

import * as React from "react"
import { BarChart3, AlertCircle } from "lucide-react"
import { useTickets } from "@/hooks/use-tickets"
import { conditionsMatchTicket } from "@/lib/sla/policy-matcher"
import type { SlaPolicyConditions } from "@/types/ticket"

// ---------------------------------------------------------------------------
// MatchPreview — live count + sample of currently-open tickets matching the
// in-progress SLA rule conditions.
// ---------------------------------------------------------------------------
// Renders below the SLA form so admins can sanity-check scope before saving.
// "0 tickets match" is a strong signal that the rule is misconfigured (e.g.,
// an impossible combination of type + category, or a subcategory filter
// that doesn't match real ticket data). This is the loud counter to the
// silent-filter bug we just fixed.
// ---------------------------------------------------------------------------

interface MatchPreviewProps {
  conditions: SlaPolicyConditions
  /** How many sample ticket IDs to show (default 3). */
  sampleSize?: number
}

const NON_OPEN_STATUSES = new Set(["solved", "closed"])

export function MatchPreview({
  conditions,
  sampleSize = 3,
}: MatchPreviewProps) {
  const { data: tickets = [], isLoading } = useTickets()

  const matches = React.useMemo(() => {
    if (isLoading) return null
    return tickets
      .filter((t) => !NON_OPEN_STATUSES.has(t.status))
      .filter((t) => conditionsMatchTicket(conditions, t))
  }, [tickets, conditions, isLoading])

  if (isLoading) {
    return (
      <div className="rounded-lg border border-input bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Computing match preview…
      </div>
    )
  }

  if (!matches) return null

  const count = matches.length
  const sample = matches.slice(0, sampleSize)
  const remaining = count - sample.length

  if (count === 0) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
        <div>
          <strong>No open tickets match this rule.</strong> If that&apos;s
          intentional (e.g., you&apos;re creating a rule for an upcoming
          category), carry on — otherwise double-check the scope above.
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2 rounded-lg border border-input bg-muted/30 px-3 py-2 text-xs">
      <BarChart3 className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <div>
        <div className="font-medium">
          {count} open {count === 1 ? "ticket" : "tickets"} currently match
          this rule.
        </div>
        {sample.length > 0 && (
          <div className="mt-0.5 text-muted-foreground">
            Sample: {sample.map((t) => t.id).join(", ")}
            {remaining > 0 && ` + ${remaining} more`}
          </div>
        )}
      </div>
    </div>
  )
}
