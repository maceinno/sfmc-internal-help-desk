"use client"

import * as React from "react"
import {
  User as UserIcon,
  Users,
  Clock,
  Calendar,
  Tag,
  X,
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { UserAutocomplete } from "@/components/shared/user-autocomplete"
import { SlaIndicator } from "@/components/tickets/sla-indicator"
import { useTimezone } from "@/hooks/use-timezone"
import { canEditTicket, canViewInternalNotes } from "@/lib/permissions/policies"
import type {
  Ticket,
  TicketStatus,
  TicketPriority,
  TicketCategory,
  User,
  CustomFieldValue,
  CustomField,
  SlaPolicy,
  DepartmentSchedule,
} from "@/types"

interface TicketSidebarPanelProps {
  ticket: Ticket
  currentUser: User
  users: User[]
  onUpdateField: (field: string, value: unknown) => void
  onCcAdd?: (userId: string) => void
  onCcRemove?: (userId: string) => void
  customFields?: CustomField[]
  slaPolicies?: SlaPolicy[]
  schedules?: DepartmentSchedule[]
  teams?: { id: string; name: string }[]
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

const STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "open", label: "Open" },
  { value: "pending", label: "Pending" },
  { value: "on_hold", label: "On Hold" },
  { value: "solved", label: "Solved" },
]

const PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
]

const CATEGORY_OPTIONS: TicketCategory[] = [
  "Loan Origination",
  "Underwriting",
  "Closing",
  "Servicing",
  "Compliance",
  "IT Systems",
  "General",
]

export function TicketSidebarPanel({
  ticket,
  currentUser,
  users,
  onUpdateField,
  onCcAdd,
  onCcRemove,
  customFields = [],
  slaPolicies,
  schedules,
  teams = [],
}: TicketSidebarPanelProps) {
  const { formatDateTime } = useTimezone()
  const isEditable = canEditTicket(currentUser, ticket)
  const isAgentOrAdmin =
    currentUser.role === "agent" || currentUser.role === "admin"

  const getUser = React.useCallback(
    (userId: string) => users.find((u) => u.id === userId),
    [users]
  )

  const creator = getUser(ticket.created_by)

  // CC list resolved to users (cc contains user IDs from ticket_cc join)
  const ccUsers = React.useMemo(() => {
    return (ticket.cc ?? []).map((userId) => {
      const user = getUser(userId)
      return { userId, user }
    })
  }, [ticket.cc, getUser])

  // Collaborators not already shown as CC
  const collaboratorUsers = React.useMemo(() => {
    const ccUserIds = new Set(ticket.cc ?? [])
    return (ticket.collaborators ?? [])
      .filter((id) => !ccUserIds.has(id))
      .map((id) => getUser(id))
      .filter(Boolean) as User[]
  }, [ticket.collaborators, ticket.cc, getUser])

  const handleAssigneeSelect = (userId: string) => {
    onUpdateField("assignedTo", userId || null)
  }

  const handleCcAdd = (userId: string) => {
    const currentCc = ticket.cc ?? []
    if (!currentCc.includes(userId)) {
      onCcAdd?.(userId)
    }
  }

  const handleCcRemove = (userId: string) => {
    onCcRemove?.(userId)
  }

  // Render read-only field
  const renderReadOnly = (label: string, value: string) => (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase text-muted-foreground">
        {label}
      </label>
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm font-medium text-gray-900">
        {value}
      </div>
    </div>
  )

  const renderCustomFields = () => {
    if (!ticket.custom_fields || ticket.custom_fields.length === 0) return null

    const visibleFields = customFields.filter(
      (cf) =>
        cf.enabled &&
        (!cf.visible_to_roles || cf.visible_to_roles.length === 0 || cf.visible_to_roles.includes(currentUser.role)) &&
        ticket.custom_fields?.some((v) => v.field_id === cf.id)
    )

    if (visibleFields.length === 0) return null

    return (
      <>
        <Separator />
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Custom Fields
          </h4>
          {visibleFields.map((field) => {
            const fieldValue = ticket.custom_fields?.find(
              (v) => v.field_id === field.id
            )
            const displayValue =
              fieldValue?.value != null ? String(fieldValue.value) : "--"

            return (
              <div key={field.id}>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  {field.label}
                </label>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-2 text-sm text-gray-900">
                  {displayValue}
                </div>
              </div>
            )
          })}
        </div>
      </>
    )
  }

  return (
    <div className="w-full space-y-6 overflow-y-auto lg:w-80">
      {/* SLA Card */}
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="mb-3 border-b border-gray-100 pb-3 font-semibold text-gray-900">
          SLA Status
        </h3>
        <SlaIndicator
          ticket={ticket}
          policies={slaPolicies}
          schedules={schedules}
        />
      </div>

      {/* Ticket Details */}
      <div className="space-y-4 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="border-b border-gray-100 pb-3 font-semibold text-gray-900">
          Ticket Details
        </h3>

        <div className="space-y-4">
          {/* Status */}
          {isAgentOrAdmin ? (
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-muted-foreground">
                Status
              </label>
              <Select
                value={ticket.status}
                onValueChange={(val) => {
                  if (val) onUpdateField("status", val)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            renderReadOnly(
              "Status",
              ticket.status === "on_hold"
                ? "On Hold"
                : ticket.status.charAt(0).toUpperCase() +
                    ticket.status.slice(1)
            )
          )}

          {/* Priority */}
          {isAgentOrAdmin ? (
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-muted-foreground">
                Priority
              </label>
              <Select
                value={ticket.priority}
                onValueChange={(val) => {
                  if (val) onUpdateField("priority", val)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            renderReadOnly(
              "Priority",
              ticket.priority.charAt(0).toUpperCase() +
                ticket.priority.slice(1)
            )
          )}

          {/* Category */}
          {isAgentOrAdmin ? (
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-muted-foreground">
                Category
              </label>
              <Select
                value={ticket.category}
                onValueChange={(val) => {
                  if (val) onUpdateField("category", val)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            renderReadOnly("Category", ticket.category)
          )}

          {/* Assignee */}
          {isAgentOrAdmin ? (
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-muted-foreground">
                Assignee
              </label>
              <UserAutocomplete
                users={users.filter((u) => u.role !== "employee")}
                selectedIds={ticket.assigned_to ? [ticket.assigned_to] : []}
                onSelect={handleAssigneeSelect}
                onRemove={() => onUpdateField("assignedTo", null)}
                placeholder="Unassigned"
              />
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-muted-foreground">
                Assignee
              </label>
              <div className="flex items-center rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm font-medium text-gray-900">
                <UserIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                {ticket.assigned_to
                  ? getUser(ticket.assigned_to)?.name ?? "Unknown"
                  : "Unassigned"}
              </div>
            </div>
          )}

          {/* Team */}
          {isAgentOrAdmin && teams.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-muted-foreground">
                Team
              </label>
              <Select
                value={ticket.assigned_team ?? ""}
                onValueChange={(val) =>
                  onUpdateField("assignedTeam", val || null)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No team</SelectItem>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Read-only fields for employees */}
          {!isAgentOrAdmin && ticket.sub_category && (
            renderReadOnly("Sub-Category", ticket.sub_category)
          )}
          {!isAgentOrAdmin && ticket.ticket_type && (
            renderReadOnly("Department", ticket.ticket_type)
          )}
        </div>

        {renderCustomFields()}
      </div>

      {/* People Card: CC & Collaborators */}
      <div className="space-y-4 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <h3 className="flex items-center font-semibold text-gray-900">
            <Users className="mr-2 h-4 w-4 text-muted-foreground" />
            People
          </h3>
          <Badge variant="secondary" className="text-[10px]">
            {new Set([
              ...(ticket.collaborators ?? []),
              ...ccUsers
                .map((c) => c.user?.id)
                .filter(Boolean),
            ]).size}
          </Badge>
        </div>

        {/* CC Section */}
        {ccUsers.length > 0 && (
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              CC'd
            </p>
            <div className="flex flex-col gap-1.5">
              {ccUsers.map(({ userId, user }) => (
                <div
                  key={userId}
                  className="flex items-center gap-3 rounded-lg p-2"
                >
                  <Avatar size="sm">
                    {user?.avatar_url && (
                      <AvatarImage src={user.avatar_url} alt="" />
                    )}
                    <AvatarFallback>
                      {getInitials(user?.name ?? userId)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {user?.name ?? userId}
                    </p>
                    {user && (
                      <p className="truncate text-xs capitalize text-muted-foreground">
                        {user.role}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className="shrink-0 bg-blue-50 text-[10px] text-blue-600"
                  >
                    CC
                  </Badge>
                  {isAgentOrAdmin && (
                    <button
                      type="button"
                      onClick={() => handleCcRemove(userId)}
                      className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Collaborators Section */}
        {collaboratorUsers.length > 0 && (
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Collaborators
            </p>
            <div className="flex flex-col gap-1.5">
              {collaboratorUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 rounded-lg p-2"
                >
                  <Avatar size="sm">
                    {user.avatar_url && (
                      <AvatarImage src={user.avatar_url} alt="" />
                    )}
                    <AvatarFallback>
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {user.name}
                    </p>
                    <p className="truncate text-xs capitalize text-muted-foreground">
                      {user.role}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {ccUsers.length === 0 && collaboratorUsers.length === 0 && (
          <p className="text-sm italic text-muted-foreground">
            No collaborators tagged yet.
          </p>
        )}

        {/* Add CC (agents/admins only) */}
        {isAgentOrAdmin && (
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Add CC
            </p>
            <UserAutocomplete
              users={users}
              selectedIds={[]}
              onSelect={handleCcAdd}
              placeholder="Search to add CC..."
              excludeIds={ccUsers.map((c) => c.userId)}
            />
          </div>
        )}
      </div>

      {/* Ticket Info */}
      <div className="space-y-3 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="border-b border-gray-100 pb-3 font-semibold text-gray-900">
          Info
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Created by</span>
            <span className="font-medium text-gray-900">
              {creator?.name ?? "Unknown"}
            </span>
          </div>
          {ticket.ticket_type && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Type</span>
              <span className="font-medium text-gray-900">
                {ticket.ticket_type}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="flex items-center text-muted-foreground">
              <Calendar className="mr-1 h-3 w-3" />
              Created
            </span>
            <span className="text-gray-900">
              {formatDateTime(ticket.created_at)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center text-muted-foreground">
              <Clock className="mr-1 h-3 w-3" />
              Updated
            </span>
            <span className="text-gray-900">
              {formatDateTime(ticket.updated_at)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
