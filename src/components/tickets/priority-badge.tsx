"use client";

import type { TicketPriority } from "@/types/ticket";

interface PriorityBadgeProps {
  priority: TicketPriority;
}

const styles: Record<TicketPriority, string> = {
  urgent: "text-red-700 bg-red-50 ring-red-600/20",
  high: "text-orange-700 bg-orange-50 ring-orange-600/20",
  medium: "text-yellow-700 bg-yellow-50 ring-yellow-600/20",
  low: "text-green-700 bg-green-50 ring-green-600/20",
};

const labels: Record<TicketPriority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ring-1 ring-inset ${styles[priority]}`}
    >
      {labels[priority]}
    </span>
  );
}
