"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Paperclip,
  Printer,
  GitMerge,
  CornerDownRight,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/tickets/status-badge"
import { PriorityBadge } from "@/components/tickets/priority-badge"
import { MessageThread } from "@/components/ticket-detail/message-thread"
import { ReplyComposer, type ReplyComposerHandle } from "@/components/ticket-detail/reply-composer"
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
import { useTabStore } from "@/stores/tab-store"
import { canViewInternalNotes } from "@/lib/permissions/policies"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import type { Ticket, Message, TicketStatus } from "@/types"

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
  const openTab = useTabStore((s) => s.openTab)

  const [showMergeModal, setShowMergeModal] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isDropTargetActive, setIsDropTargetActive] = React.useState(false)
  const [isAttachmentsExpanded, setIsAttachmentsExpanded] =
    React.useState(false)
  const replyComposerRef = React.useRef<ReplyComposerHandle>(null)
  const dragCounter = React.useRef(0)
  // Set while we're forwarding a sidebar status change through the composer
  // (so the typed reply gets sent alongside the status change). Stops the
  // status update path inside handleReplySubmit from re-entering this same
  // forward path and looping.
  const isFlushingDraftRef = React.useRef(false)

  const handleConversationDragEnter = React.useCallback((e: React.DragEvent) => {
    if (!Array.from(e.dataTransfer.types).includes('Files')) return
    e.preventDefault()
    dragCounter.current += 1
    setIsDropTargetActive(true)
  }, [])

  const handleConversationDragLeave = React.useCallback((e: React.DragEvent) => {
    if (!Array.from(e.dataTransfer.types).includes('Files')) return
    e.preventDefault()
    dragCounter.current = Math.max(0, dragCounter.current - 1)
    if (dragCounter.current === 0) setIsDropTargetActive(false)
  }, [])

  const handleConversationDragOver = React.useCallback((e: React.DragEvent) => {
    if (!Array.from(e.dataTransfer.types).includes('Files')) return
    e.preventDefault()
  }, [])

  const handleConversationDrop = React.useCallback((e: React.DragEvent) => {
    if (!Array.from(e.dataTransfer.types).includes('Files')) return
    e.preventDefault()
    dragCounter.current = 0
    setIsDropTargetActive(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) replyComposerRef.current?.addFiles(files)
  }, [])

  const isLoading = isTicketLoading || isUserLoading

  // Full users list for assignee display, mention dropdown, etc.
  const users = React.useMemo(() => {
    if (allUsers.length > 0) return allUsers
    if (!currentUser) return []
    return [currentUser]
  }, [allUsers, currentUser])

  // Open this ticket as a tab once it loads. Depends on primitives so it
  // doesn't refire when `users` keeps a fresh reference each render.
  const requesterName = React.useMemo(
    () => users.find((u) => u.id === ticket?.created_by)?.name,
    [users, ticket?.created_by],
  )
  React.useEffect(() => {
    if (!ticket) return
    openTab({
      id: ticket.id,
      title: ticket.title,
      requesterName,
    })
  }, [ticket?.id, ticket?.title, requesterName, openTab])

  // Human-friendly labels for the auto-save toast.
  const FIELD_LABELS: Record<string, string> = {
    status: 'Status',
    priority: 'Priority',
    category: 'Category',
    subCategory: 'Sub-category',
    ticketType: 'Department',
    assignedTo: 'Assignee',
    assignedTeam: 'Team',
  }

  const handleUpdateField = React.useCallback(
    (field: string, value: unknown) => {
      if (!ticket) return

      // Status change initiated from the sidebar while a reply is typed:
      // forward to the composer so the draft + status change post as one
      // atomic action (Zendesk parity). The composer's onSubmit will route
      // back here with the status update — the ref guard prevents looping.
      if (
        field === 'status' &&
        !isFlushingDraftRef.current &&
        replyComposerRef.current?.hasDraft()
      ) {
        isFlushingDraftRef.current = true
        Promise.resolve(
          replyComposerRef.current.submitDraft(value as TicketStatus),
        ).finally(() => {
          isFlushingDraftRef.current = false
        })
        return
      }

      const oldValue = (ticket as unknown as Record<string, unknown>)[field === 'assignedTo' ? 'assigned_to' : field]

      updateTicket.mutate(
        {
          id: ticket.id,
          [field]: value,
        } as Parameters<typeof updateTicket.mutate>[0],
        {
          onSuccess: () => {
            // Surface the auto-save so the user isn't left wondering whether
            // the change stuck. Skip clear-only edits (empty → empty).
            const label = FIELD_LABELS[field] ?? field
            toast.success(`${label} saved`, { duration: 1500 })

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

            // Solving from the detail view returns the agent to /tickets so
            // their previously-active view (held in Zustand) restores.
            const role = currentUser?.role
            if (
              field === 'status' &&
              value === 'solved' &&
              oldValue !== 'solved' &&
              (role === 'agent' || role === 'admin')
            ) {
              router.push('/tickets')
            }
          },
          onError: () => {
            toast.error('Could not save change. Please try again.')
          },
        }
      )
    },
    [ticket, updateTicket, currentUser?.role, router]
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
      nextStatus?: TicketStatus | null
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

        // Apply Submit-as-<status> after the reply lands. Routes through
        // handleUpdateField so notify hooks + the solved-redirect fire too.
        if (
          !message.isInternal &&
          message.nextStatus &&
          message.nextStatus !== ticket.status
        ) {
          handleUpdateField('status', message.nextStatus)
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to submit reply")
      } finally {
        setIsSubmitting(false)
      }
    },
    [ticket, currentUser, queryClient, handleUpdateField]
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

  const handleBack = React.useCallback(() => {
    const role = currentUser?.role
    const fallback =
      role === 'agent' || role === 'admin' ? '/tickets' : '/my-tickets'
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      // If history.back() lands outside the app (e.g., direct link open),
      // fall back shortly after.
      setTimeout(() => {
        if (window.location.pathname.startsWith(`/tickets/${id}`)) {
          router.push(fallback)
        }
      }, 100)
    } else {
      router.push(fallback)
    }
  }, [router, currentUser?.role, id])

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
      <div className="mb-4 flex flex-col gap-3 min-w-0 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleBack}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">
                #{ticket.id}
              </h1>
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
            </div>
            <h2 className="mt-0.5 text-base text-gray-600 break-words">{ticket.title}</h2>
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
        <div
          className={`relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-colors ${
            isDropTargetActive
              ? 'border-blue-400 ring-2 ring-blue-200'
              : 'border-gray-100'
          }`}
          onDragEnter={handleConversationDragEnter}
          onDragLeave={handleConversationDragLeave}
          onDragOver={handleConversationDragOver}
          onDrop={handleConversationDrop}
        >
          {isDropTargetActive && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-blue-50/90">
              <div className="rounded-lg border-2 border-dashed border-blue-400 bg-white px-6 py-4 text-sm font-medium text-blue-700 shadow-sm">
                Drop files to attach to your reply
              </div>
            </div>
          )}
          <MessageThread
            messages={visibleMessages}
            users={users}
            currentUserId={currentUser.id}
            ticketDescription={ticket.description}
            ticketCreatedBy={ticket.created_by}
            ticketCreatedAt={ticket.created_at}
            attachments={ticket.attachments}
          />

          {/* Attachments (shown between thread and composer). Collapsed by
              default so the conversation is never buried; user can expand to
              see the full list (with its own scroll cap). */}
          {ticket.attachments && ticket.attachments.length > 0 && (
            <div className="shrink-0 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsAttachmentsExpanded((v) => !v)}
                className="flex w-full items-center justify-between px-6 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <span className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  Attachments ({ticket.attachments.length})
                </span>
                {isAttachmentsExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
              {isAttachmentsExpanded && (
                <div className="max-h-56 overflow-y-auto border-t border-gray-100 px-6 py-4">
                  <AttachmentList
                    attachments={ticket.attachments}
                    users={users}
                  />
                </div>
              )}
            </div>
          )}

          <ReplyComposer
            ref={replyComposerRef}
            ticketId={ticket.id}
            ticketCreatedBy={ticket.created_by}
            ticketCc={ticket.cc}
            ticketCollaborators={ticket.collaborators}
            currentStatus={ticket.status}
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
