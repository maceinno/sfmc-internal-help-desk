"use client";

import { AlertTriangle, Clock } from "lucide-react";
import type { Ticket, SlaPolicy, DepartmentSchedule } from "@/types/ticket";
import { getSlaStatus, formatTimeRemaining } from "@/lib/sla";

interface SlaIndicatorProps {
  ticket: Ticket;
  policies?: SlaPolicy[];
  schedules?: DepartmentSchedule[];
}

export function SlaIndicator({
  ticket,
  policies,
  schedules,
}: SlaIndicatorProps) {
  const sla = getSlaStatus(ticket, policies, schedules);

  if (!sla) {
    return null;
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
