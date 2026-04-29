"use client";

import { AlertTriangle, Clock } from "lucide-react";
import type { Ticket, SlaPolicy, DepartmentSchedule } from "@/types/ticket";
import { getSlaStatus, formatTimeRemaining } from "@/lib/sla";

interface SlaIndicatorProps {
  ticket: Ticket;
  policies?: SlaPolicy[];
  schedules?: DepartmentSchedule[];
  /**
   * What to show when no SLA policy matches the ticket.
   *  - `compact` (default): muted "—" with a tooltip explanation.
   *  - `verbose`: "No SLA configured" full text — used in dedicated SLA
   *    cards (ticket detail sidebar) where empty space looks broken.
   *  - `hidden`: render nothing.
   */
  emptyState?: "compact" | "verbose" | "hidden";
}

export function SlaIndicator({
  ticket,
  policies,
  schedules,
  emptyState = "compact",
}: SlaIndicatorProps) {
  const sla = getSlaStatus(ticket, policies, schedules);

  if (!sla) {
    if (emptyState === "hidden") return null;
    if (emptyState === "verbose") {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
          <Clock className="h-3.5 w-3.5 text-gray-400" />
          No SLA configured for this ticket
        </span>
      );
    }
    // compact
    return (
      <span
        className="inline-flex items-center text-xs text-gray-400"
        title="No SLA policy matches this ticket"
      >
        —
      </span>
    );
  }

  const timeText = formatTimeRemaining(sla.timeRemainingMs);

  if (sla.isOverdue) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
        <AlertTriangle className="h-3.5 w-3.5" />
        {timeText}
      </span>
    );
  }

  if (sla.isAtRisk) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
        <Clock className="h-3.5 w-3.5" />
        {timeText}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
      <Clock className="h-3.5 w-3.5" />
      {timeText}
    </span>
  );
}
