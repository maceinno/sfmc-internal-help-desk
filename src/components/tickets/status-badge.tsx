"use client";

import type { TicketStatus } from "@/types/ticket";

interface StatusBadgeProps {
  status: TicketStatus;
}

const styles: Record<TicketStatus, string> = {
  new: "bg-yellow-100 text-yellow-800 border-yellow-300",
  open: "bg-red-100 text-red-800 border-red-200",
  pending: "bg-blue-100 text-blue-800 border-blue-200",
  on_hold: "bg-gray-900 text-white border-gray-900",
  solved: "bg-gray-100 text-gray-600 border-gray-200",
};

const dotStyles: Record<TicketStatus, string> = {
  new: "bg-yellow-500",
  open: "bg-red-500",
  pending: "bg-blue-500",
  on_hold: "bg-white",
  solved: "bg-gray-400",
};

const labels: Record<TicketStatus, string> = {
  new: "New",
  open: "Open",
  pending: "Pending",
  on_hold: "On Hold",
  solved: "Solved",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full mr-1.5 ${dotStyles[status]}`}
      />
      {labels[status]}
    </span>
  );
}
