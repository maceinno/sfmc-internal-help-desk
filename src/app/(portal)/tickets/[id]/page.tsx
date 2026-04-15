"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  ChevronLeft,
  Printer,
  GitMerge,
  CornerDownRight,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/tickets/status-badge"
import { PriorityBadge } from "@/components/tickets/priority-badge"
import { MessageThread } from "@/components/ticket-detail/message-thread"
import { ReplyComposer } from "@/components/ticket-detail/reply-composer"
import { TicketSidebarPanel } from "@/components/ticket-detail/ticket-sidebar-panel"
import { AttachmentList } from "@/components/ticket-detail/attachment-list"
import { MergeModal } from "@/components/ticket-detail/merge-modal"
import { useTicket, useTickets, useUpdateTicket } from "@/hooks/use-tickets"
import { useCurrentUser } from "@/hooks/use-current-user"
import { useUsers } from "@/hooks/use-users"
import { useAuth } from "@clerk/nextjs"
import { createClerkSupabaseClient } from "@/lib/supabase/client"
import { useCannedResponses, useTeams, useCustomFields } from "@/hooks/use-admin-config"
import { useUIStore } from "@/stores/ui-store"
import { canViewInternalNotes } from "@/lib/permissions/policies"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import type { Ticket, Message } from "@/types"

export default function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = React.use(params)
  const router = useRouter()

  const { data: ticket, isLoading: isTicketLoading } = useTicket(id)
  const { profile: currentUser, isLoading: isUserLoading } = useCurrentUser()
  const { getToken } = useAuth()
  const { data: cannedResponses } = useCannedResponses()
  const { data: teams } = useTeams()
  const { data: customFields } = useCustomFields()
  const { data: allUsers = [] } = useUsers()
  const { data: allTickets = [] } = useTickets()
  const updateTicket = useUpdateTicket()
  const queryClient = useQueryClient()
  const { setFollowUpFromTicketId } = useUIStore()

  const [showMergeModal, setShowMergeModal] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const isLoading = isTicketLoading || isUserLoading

  // Full users list for assignee display, mention dropdown, etc.
  const users = React.useMemo(() => {
    if (allUsers.length > 0) return allUsers
    if (!currentUser) return []
    return [currentUser]
  }, [allUsers, currentUser])

  const handleUpdateField = React.useCallback(
    (field: string, value: unknown) => {
      if (!ticket) return

      const oldValue = (ticket as Record<string, unknown>)[field === 'assignedTo' ? 'assigned_to' : field]

      updateTicket.mutate(
        {
          id: ticket.id,
          [field]: value,
        } as Parameters<typeof updateTicket.mutate>[0],
        {
          onSuccess: () => {
            // Fire email notifications for status and assignment changes
            if (field === 'status' && oldValue !== value) {
              fetch(`/api/tickets/${ticket.id}/notify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'status_changed',
                  ticketTitle: ticket.title,
                  createdBy: ticket.created_by,
                  oldStatus: oldValue,
                  newStatus: value,
                }),
              }).catch(() => {})
            }
            if (field === 'assignedTo' && value && oldValue !== value) {
              fetch(`/api/tickets/${ticket.id}/notify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'assignment_changed',
                  ticketTitle: ticket.title,
                  createdBy: ticket.created_by,
                  newAssigneeId: value,
                }),
              }).catch(() => {})
            }
          },
        }
      )
    },
    [ticket, updateTicket]
  )

  const handleCcAdd = React.useCallback(
    async (userId: string) => {
      if (!ticket) return
      try {
        const token = await getToken({ template: "supabase" })
        if (!token) return
        const supabase = createClerkSupabaseClient(token)
        const { error } = await supabase
          .from("ticket_cc")
          .upsert({ ticket_id: ticket.id, user_id: userId }, { onConflict: "ticket_id,user_id" })
        if (error) throw error
        queryClient.invalidateQueries({ queryKey: ["tickets", "detail", ticket.id] })
      } catch {
        toast.error("Failed to add CC")
      }
    },
    [ticket, getToken, queryClient]
  )

  const handleCcRemove = React.useCallback(
    async (userId: string) => {
      if (!ticket) return
      try {
        const token = await getToken({ template: "supabase" })
        if (!token) return
        const supabase = createClerkSupabaseClient(token)
        const { error } = await supabase
          .from("ticket_cc")
          .delete()
          .eq("ticket_id", ticket.id)
          .eq("user_id", userId)
        if (error) throw error
        queryClient.invalidateQueries({ queryKey: ["tickets", "detail", ticket.id] })
      } catch {
        toast.error("Failed to remove CC")
      }
    },
    [ticket, getToken, queryClient]
  )

  const handleReplySubmit = React.useCallback(
    async (message: {
      content: string
      isInternal: boolean
      taggedAgents?: string[]
      attachments?: File[]
      cannedResponseId?: string
    }) => {
      if (!ticket || !currentUser) return
      setIsSubmitting(true)

      try {
        // Upload attachments first if any
        const attachmentIds: string[] = []
        if (message.attachments && message.attachments.length > 0) {
          for (const file of message.attachments) {
            const formData = new FormData()
            formData.append("file", file)
            formData.append("ticketId", ticket.id)

            const uploadRes = await fetch("/api/upload", {
              method: "POST",
              body: formData,
            })
            if (uploadRes.ok) {
              const uploadData = await uploadRes.json()
              if (uploadData.id) attachmentIds.push(uploadData.id)
            }
          }
        }

        // Submit reply via API
        const res = await fetch(`/api/tickets/${ticket.id}/reply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: message.content,
            isInternal: message.isInternal,
            taggedAgents: message.taggedAgents,
            attachmentIds: attachmentIds.length > 0 ? attachmentIds : undefined,
            cannedResponseId: message.cannedResponseId,
          }),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error ?? "Failed to submit reply")
        }

        // Refresh ticket data to show new message
        queryClient.invalidateQueries({ queryKey: ["tickets", "detail", ticket.id] })
        queryClient.invalidateQueries({ queryKey: ["tickets"] })
        toast.success(message.isInternal ? "Internal note added" : "Reply sent")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to submit reply")
      } finally {
        setIsSubmitting(false)
      }
    },
    [ticket, currentUser, queryClient]
  )

  const handleMergeConfirm = React.useCallback(
    async (targetTicket: Ticket, direction: "into" | "from") => {
      if (!ticket || !currentUser) return

      // Determine source and target based on direction
      const sourceId = direction === "into" ? ticket.id : targetTicket.id
      const targetId = direction === "into" ? targetTicket.id : ticket.id

      try {
        const res = await fetch(`/api/tickets/${sourceId}/merge`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetTicketId: targetId }),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error ?? "Failed to merge tickets")
        }

        queryClient.invalidateQueries({ queryKey: ["tickets"] })
        queryClient.invalidateQueries({ queryKey: ["tickets", "detail", ticket.id] })
        toast.success(`Ticket merged successfully`)
        setShowMergeModal(false)

        // If current ticket was merged into another, navigate there
        if (direction === "into") {
          router.push(`/tickets/${targetTicket.id}`)
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to merge")
      }
    },
    [ticket, currentUser, queryClient, router]
  )

  const handlePrint = React.useCallback(() => {
    window.print()
  }, [])

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading ticket...</p>
        </div>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900">
            Ticket not found
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The ticket you're looking for doesn't exist or you don't have access.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.back()}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return null
  }

  const isAgentOrAdmin =
    currentUser.role === "agent" || currentUser.role === "admin"
  const showInternalNotes = canViewInternalNotes(currentUser)

  // Filter messages: employees don't see internal notes
  const visibleMessages = showInternalNotes
    ? (ticket.messages ?? [])
    : (ticket.messages ?? []).filter((m) => !m.is_internal)

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => router.back()}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">
                #{ticket.id}
              </h1>
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
            </div>
            <h2 className="mt-0.5 text-base text-gray-600">{ticket.title}</h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Follow-up button */}
          {ticket.status === "solved" && !ticket.parent_ticket_id && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFollowUpFromTicketId(ticket.id)
                router.push("/tickets/new")
              }}
            >
              <CornerDownRight className="mr-2 h-4 w-4" />
              Create Follow-Up
            </Button>
          )}

          {/* Merge button */}
          {isAgentOrAdmin &&
            !ticket.merged_into_id &&
            ticket.status !== "solved" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMergeModal(true)}
                className="text-purple-600 hover:text-purple-700"
              >
                <GitMerge className="mr-2 h-4 w-4" />
                Merge
              </Button>
            )}

          {/* Print button */}
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      {/* Merged Banner */}
      {ticket.merged_into_id && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-4 py-3">
          <GitMerge className="h-4 w-4 text-purple-600" />
          <span className="text-sm text-purple-800">
            This ticket was merged into{" "}
            <button
              type="button"
              onClick={() =>
                router.push(`/tickets/${ticket.merged_into_id}`)
              }
              className="font-semibold text-purple-700 hover:underline"
            >
              #{ticket.merged_into_id}
            </button>
          </span>
        </div>
      )}

      {ticket.merged_ticket_ids && ticket.merged_ticket_ids.length > 0 && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-4 py-3">
          <GitMerge className="h-4 w-4 text-purple-600" />
          <span className="text-sm text-purple-800">
            {ticket.merged_ticket_ids.length} ticket
            {ticket.merged_ticket_ids.length !== 1 ? "s" : ""} merged into
            this ticket:{" "}
            {ticket.merged_ticket_ids.map((mergedId, idx) => (
              <span key={mergedId}>
                <button
                  type="button"
                  onClick={() => router.push(`/tickets/${mergedId}`)}
                  className="font-semibold text-purple-700 hover:underline"
                >
                  #{mergedId}
                </button>
                {idx < ticket.merged_ticket_ids!.length - 1 ? ", " : ""}
              </span>
            ))}
          </span>
        </div>
      )}

      {/* Main Layout */}
      <div className="flex flex-1 flex-col gap-6 overflow-hidden lg:flex-row">
        {/* Left: Conversation + Reply */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <MessageThread
            messages={visibleMessages}
            users={users}
            currentUserId={currentUser.id}
            ticketDescription={ticket.description}
            ticketCreatedBy={ticket.created_by}
            ticketCreatedAt={ticket.created_at}
            attachments={ticket.attachments}
          />

          {/* Attachments (shown between thread and composer) */}
          {ticket.attachments && ticket.attachments.length > 0 && (
            <div className="border-t border-gray-100 px-6 py-4">
              <AttachmentList
                attachments={ticket.attachments}
                users={users}
              />
            </div>
          )}

          <ReplyComposer
            ticketId={ticket.id}
            ticketCreatedBy={ticket.created_by}
            ticketCc={ticket.cc}
            ticketCollaborators={ticket.collaborators}
            users={users}
            currentUser={currentUser}
            cannedResponses={cannedResponses ?? []}
            onSubmit={handleReplySubmit}
          />
        </div>

        {/* Right: Sidebar */}
        <TicketSidebarPanel
          ticket={ticket}
          currentUser={currentUser}
          users={users}
          onUpdateField={handleUpdateField}
          onCcAdd={handleCcAdd}
          onCcRemove={handleCcRemove}
          teams={teams?.map((t) => ({ id: t.id, name: t.name })) ?? []}
          customFields={customFields ?? []}
        />
      </div>

      {/* Merge Modal */}
      <MergeModal
        open={showMergeModal}
        onOpenChange={setShowMergeModal}
        currentTicket={ticket}
        allTickets={allTickets.filter((t) => t.id !== ticket.id && t.status !== "solved" && !t.merged_into_id)}
        onConfirm={handleMergeConfirm}
      />
    </div>
  )
}
