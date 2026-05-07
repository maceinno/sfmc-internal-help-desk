"use client"

import * as React from "react"
import { AlertTriangle } from "lucide-react"
import { conditionsOverlap } from "@/lib/sla/policy-matcher"
import type { SlaPolicy, SlaPolicyConditions } from "@/types/ticket"

// ---------------------------------------------------------------------------
// ConflictIndicator — inline warning when the in-progress SLA rule's scope
// overlaps with any other enabled rule.
// ---------------------------------------------------------------------------
// Multiple rules can technically match the same ticket; the matcher resolves
// by lowest sort_order. That's a feature for fallback patterns ("Lending
// catch-all" with sort_order 99 + specific "Lending — Income Opinion" at
// sort_order 5) but a footgun when admins accidentally double-cover the
// same scope. This indicator surfaces overlaps live so admins can see them
// while editing rather than discovering them in the wild.
// ---------------------------------------------------------------------------

interface ConflictIndicatorProps {
  /** The conditions being edited. */
  conditions: SlaPolicyConditions
  /** All policies currently in scope (local edits, not the saved set). */
  policies: SlaPolicy[]
  /** ID of the rule being edited; excluded from overlap checks. Pass
   *  `null` when the form is for an unsaved new rule. */
  currentRuleId: string | null
}

export function ConflictIndicator({
  conditions,
  policies,
  currentRuleId,
}: ConflictIndicatorProps) {
  const overlaps = React.useMemo(() => {
    return policies
      .filter((p) => p.enabled && p.id !== currentRuleId)
      .filter((p) => conditionsOverlap(conditions, p.conditions))
      .sort((a, b) => a.sort_order - b.sort_order)
  }, [conditions, policies, currentRuleId])

  if (overlaps.length === 0) return null

  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
      <div className="flex-1">
        <div className="font-medium">
          Scope overlaps with{" "}
          {overlaps.length === 1 ? "another rule" : `${overlaps.length} other rules`}.
        </div>
        <div className="mt-1 text-amber-800">
          Tickets matching both will use whichever has the{" "}
          <strong>lower sort order</strong>. If that&apos;s intentional
          (e.g., you&apos;re adding a more-specific override), carry on.
        </div>
        <ul className="mt-1.5 space-y-0.5">
          {overlaps.map((p) => (
            <li key={p.id} className="flex items-center gap-1.5">
              <span className="inline-block min-w-[1.5rem] rounded bg-amber-200 px-1 text-center font-mono text-[10px] text-amber-900">
                #{p.sort_order}
              </span>
              <span className="font-medium">{p.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
