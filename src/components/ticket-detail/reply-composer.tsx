"use client"

import * as React from "react"
import {
  Send,
  Lock,
  Paperclip,
  X,
  FileText,
  Loader2,
  ChevronUp,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CannedResponsePicker } from "@/components/shared/canned-response-picker"
import { FileUpload } from "@/components/shared/file-upload"
import { RichTextEditor } from "@/components/shared/rich-text-editor"
import { cn } from "@/lib/utils"
import type { User, CannedResponse, TicketStatus } from "@/types"

const STATUS_DOT: Record<TicketStatus, string> = {
  new: "bg-yellow-500",
  open: "bg-red-500",
  pending: "bg-blue-500",
  on_hold: "bg-gray-700",
  solved: "bg-gray-400",
}

const STATUS_LABEL: Record<TicketStatus, string> = {
  new: "New",
  open: "Open",
  pending: "Pending",
  on_hold: "On Hold",
  solved: "Solved",
}

const STATUS_OPTIONS: TicketStatus[] = [
  "new",
  "open",
  "pending",
  "on_hold",
  "solved",
]

// Default "next" status when an agent replies. Mirrors Zendesk: replying to a
// new ticket moves it into the open queue; replying to an open ticket marks
// it pending on the user; solved tickets stay solved (a reply doesn't reopen
// unless the agent explicitly picks a different status from the dropdown).
function defaultNextStatus(current: TicketStatus): TicketStatus {
  switch (current) {
    case "new":
      return "open"
    case "open":
      return "pending"
    default:
      return current
  }
}

interface ReplyComposerProps {
  ticketId: string
  ticketCreatedBy: string
  ticketCc?: string[]
  ticketCollaborators?: string[]
  currentStatus: TicketStatus
  users: User[]
  currentUser: User
  cannedResponses?: CannedResponse[]
  onSubmit: (message: {
    content: string
    isInternal: boolean
    taggedAgents?: string[]
    attachments?: File[]
    cannedResponseId?: string
    nextStatus?: TicketStatus | null
  }) => void | Promise<void>
  /**
   * Apply a status-only change without posting a message. Called when the
   * composer is empty and pendingStatus differs from currentStatus — gives
   * agents a way to mark a ticket Solved/Pending/etc. directly from the
   * composer button without typing "you're welcome" first.
   */
  onStatusOnlyChange?: (status: TicketStatus) => void | Promise<void>
  onCannedResponseSelect?: (response: CannedResponse) => void
}

export interface ReplyComposerHandle {
  addFiles: (files: File[]) => void
  /** True when the composer has any non-whitespace content typed. */
  hasDraft: () => boolean
  /**
   * Send the current draft (if any) with the given status change. Used
   * when an agent triggers a status change from the right sidebar while a
   * reply is typed — Zendesk-style atomic "post + status" in one action.
   * No-op if the composer is empty.
   */
  submitDraft: (nextStatus: TicketStatus | null) => Promise<void>
}


export const ReplyComposer = React.forwardRef<
  ReplyComposerHandle,
  ReplyComposerProps
>(function ReplyComposer({
  ticketId,
  ticketCreatedBy,
  ticketCc = [],
  ticketCollaborators = [],
  currentStatus,
  users,
  currentUser,
  cannedResponses = [],
  onSubmit,
  onStatusOnlyChange,
  onCannedResponseSelect,
}, ref) {
  // replyText now holds HTML produced by the rich-text editor. Empty
  // editor maps to "" (Tiptap's empty-doc marker is replaced upstream).
  const [replyText, setReplyText] = React.useState("")
  const [isInternalNote, setIsInternalNote] = React.useState(false)
  const [showCannedPicker, setShowCannedPicker] = React.useState(false)
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([])
  const [showFileUpload, setShowFileUpload] = React.useState(false)
  const [pendingCannedResponseId, setPendingCannedResponseId] = React.useState<string | undefined>()
  const [isSending, setIsSending] = React.useState(false)
  // null = "Send (no status change)"; otherwise the status the reply will commit.
  const [pendingStatus, setPendingStatus] = React.useState<TicketStatus | null>(
    () => defaultNextStatus(currentStatus),
  )

  const isAgentOrAdmin =
    currentUser.role === "agent" || currentUser.role === "admin"

  // True when the editor has any non-whitespace content. Strip tags, then
  // check for printable characters.
  const hasContent = React.useMemo(() => {
    if (!replyText) return false
    return replyText.replace(/<[^>]*>/g, "").trim().length > 0
  }, [replyText])

  // Mirror the sidebar's status pick into the Submit-as button. When the
  // ticket's current status changes from outside (e.g., agent picked a
  // status in TicketSidebarPanel), match it exactly — picking "Solved" on
  // the sidebar should update the button to "Submit as Solved", not auto-
  // advance via defaultNextStatus. Skip if the user explicitly chose
  // "Send (no status change)" (null) on the composer dropdown.
  const lastCurrentStatusRef = React.useRef(currentStatus)
  React.useEffect(() => {
    if (lastCurrentStatusRef.current !== currentStatus) {
      lastCurrentStatusRef.current = currentStatus
      setPendingStatus((prev) => (prev === null ? null : currentStatus))
    }
  }, [currentStatus])

  // @-mention autocomplete is temporarily not wired into the rich-text
  // editor — agents can still type @Name as plain text but the popup is
  // disabled while we move the composer to Tiptap. Mentions auto-derived
  // from message content can be re-introduced as a Tiptap suggestion in
  // a follow-up.

  // Single send path. `source` decides how nextStatus is resolved:
  //   - 'button' (the Submit button): pendingStatus from the dropdown,
  //     forced to null in internal-note mode (notes never auto-change
  //     status from a button click).
  //   - 'sidebar' (status change in TicketSidebarPanel with a typed
  //     draft): always honor the override the sidebar passed in,
  //     including for internal notes — the user explicitly clicked a
  //     status while typing, so they want both.
  const sendInternal = async (
    source: 'button' | 'sidebar',
    overrideStatus?: TicketStatus | null,
  ) => {
    if (!hasContent || isSending) return
    setIsSending(true)
    try {
      const finalNextStatus =
        source === 'sidebar'
          ? overrideStatus ?? null
          : isInternalNote
          ? null
          : pendingStatus
      // Extract mentioned user ids from the HTML. Tiptap renders mentions
      // as <span data-type="mention" data-id="<id>">@Name</span>; we
      // dedupe and pass them as taggedAgents so notify-flow + UI chips
      // pick up the tags. Empty array → undefined to keep the API call
      // shape unchanged when there are no mentions.
      const taggedAgents = (() => {
        if (typeof window === "undefined") return undefined
        const ids = new Set<string>()
        const doc = new DOMParser().parseFromString(replyText, "text/html")
        for (const el of Array.from(
          doc.querySelectorAll('[data-type="mention"][data-id]'),
        )) {
          const id = el.getAttribute("data-id")
          if (id) ids.add(id)
        }
        return ids.size > 0 ? Array.from(ids) : undefined
      })()
      await onSubmit({
        content: replyText,
        isInternal: isInternalNote,
        taggedAgents,
        attachments: selectedFiles.length > 0 ? selectedFiles : undefined,
        cannedResponseId: pendingCannedResponseId,
        nextStatus: finalNextStatus,
      })
      setReplyText("")
      setSelectedFiles([])
      setShowFileUpload(false)
      setPendingCannedResponseId(undefined)
    } finally {
      setIsSending(false)
    }
  }

  const handleSend = () => sendInternal('button')

  // Empty-composer + sidebar-picked-different-status: clicking the primary
  // button applies the status change directly without posting a message.
  // Lets agents close out a ticket (or move Pending/On Hold/etc.) from the
  // composer button as a one-click action — no "you're welcome" required.
  // Disabled in internal-note mode (notes never carry status changes), and
  // when pendingStatus matches currentStatus (nothing to do).
  const canStatusOnly =
    !hasContent &&
    !isInternalNote &&
    pendingStatus !== null &&
    pendingStatus !== currentStatus &&
    Boolean(onStatusOnlyChange)

  const handlePrimaryClick = () => {
    if (canStatusOnly && pendingStatus) {
      onStatusOnlyChange?.(pendingStatus)
      return
    }
    handleSend()
  }

  const handleCannedResponseSelect = (response: CannedResponse) => {
    // Canned responses are stored as plain text. Wrap each line in a <p>
    // so it slots into the rich-text editor cleanly without losing line
    // breaks. Templates can be migrated to HTML later if needed.
    const processedContent = response.content
      .replace(/\{\{requester_name\}\}/g, users.find((u) => u.id === ticketCreatedBy)?.name || "Customer")
      .replace(/\{\{agent_name\}\}/g, currentUser.name)
      .replace(/\{\{ticket_id\}\}/g, ticketId)

    const asHtml = processedContent
      .split(/\n/)
      .map((line) => `<p>${line.length > 0 ? line : "<br />"}</p>`)
      .join("")

    setReplyText((prev) => (prev ? prev + asHtml : asHtml))
    setShowCannedPicker(false)
    setPendingCannedResponseId(response.id)
    onCannedResponseSelect?.(response)
  }

  const handleFilesSelected = (files: File[]) => {
    setSelectedFiles((prev) => [...prev, ...files])
  }

  const handleEditorPasteFiles = React.useCallback((files: File[]) => {
    if (files.length === 0) return
    setSelectedFiles((prev) => [...prev, ...files])
    setShowFileUpload(true)
  }, [])

  React.useImperativeHandle(ref, () => ({
    addFiles: (files: File[]) => {
      if (files.length === 0) return
      setSelectedFiles((prev) => [...prev, ...files])
      setShowFileUpload(true)
    },
    hasDraft: () => hasContent,
    submitDraft: (nextStatus: TicketStatus | null) =>
      sendInternal('sidebar', nextStatus),
  }))

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  // Generate thumbnail previews for image files
  const filePreviews = React.useMemo(() => {
    return selectedFiles.map((file) => ({
      file,
      isImage: file.type.startsWith("image/"),
      url: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
    }))
  }, [selectedFiles])

  // Clean up object URLs
  React.useEffect(() => {
    return () => {
      filePreviews.forEach((p) => {
        if (p.url) URL.revokeObjectURL(p.url)
      })
    }
  }, [filePreviews])

  return (
    <div className="border-t border-gray-100 bg-gray-50 p-4">
      <div
        className={`relative rounded-lg border bg-white shadow-sm transition-all focus-within:ring-2 ${
          isInternalNote
            ? "border-amber-300 focus-within:ring-amber-200"
            : "border-gray-300 focus-within:ring-blue-500"
        }`}
      >
        {/* Toggle Tabs */}
        <div className="flex items-center justify-between rounded-t-lg border-b border-gray-100 bg-gray-50/50 px-3 py-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsInternalNote(false)}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                !isInternalNote
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-muted-foreground hover:text-gray-700"
              }`}
            >
              Public Reply
            </button>
            {isAgentOrAdmin && (
              <button
                type="button"
                onClick={() => setIsInternalNote(true)}
                className={`flex items-center rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                  isInternalNote
                    ? "bg-amber-100 text-amber-800 shadow-sm"
                    : "text-muted-foreground hover:text-gray-700"
                }`}
              >
                <Lock className="mr-1.5 h-3 w-3" /> Internal Note
              </button>
            )}
          </div>
        </div>

        {/* Editor */}
        <div
          className={cn(
            isInternalNote && "[&_.tiptap]:bg-amber-50/30",
            "[&_.rte-wrapper]:rounded-none [&_.rte-wrapper]:border-0",
          )}
        >
          <RichTextEditor
            value={replyText}
            onChange={setReplyText}
            placeholder={
              isInternalNote
                ? "Add an internal note..."
                : "Type your reply..."
            }
            onPasteFiles={handleEditorPasteFiles}
            mentionUsers={users.map((u) => ({
              id: u.id,
              name: u.name,
              email: u.email,
            }))}
            minRows={5}
            className="rte-wrapper border-0 rounded-none focus-within:ring-0"
          />
        </div>

        {/* Attached Files Preview */}
        {selectedFiles.length > 0 && (
          <div className="border-t border-gray-100 px-3 py-2">
            <div className="flex flex-wrap gap-2">
              {filePreviews.map((preview, index) => (
                <div
                  key={index}
                  className="group relative flex items-center gap-2 rounded-lg border bg-gray-50 px-2 py-1.5"
                >
                  {preview.isImage && preview.url ? (
                    <img
                      src={preview.url}
                      alt=""
                      className="h-10 w-10 rounded object-cover"
                    />
                  ) : (
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div className="min-w-0 max-w-[120px]">
                    <p className="truncate text-xs font-medium">
                      {preview.file.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {(preview.file.size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(index)}
                    className="ml-1 rounded-full p-0.5 text-muted-foreground hover:bg-gray-200 hover:text-gray-700"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* File Upload Zone (toggle) */}
        {showFileUpload && (
          <div className="border-t border-gray-100 px-3 py-2">
            <FileUpload
              onFilesSelected={handleFilesSelected}
              existingFiles={[]}
              onRemoveFile={handleRemoveFile}
            />
          </div>
        )}

        {/* Bottom Bar */}
        <div className="flex items-center justify-between rounded-b-lg border-t border-gray-100 bg-gray-50/50 px-3 py-2">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowFileUpload(!showFileUpload)}
              title="Attach file"
              className="relative"
            >
              <Paperclip className="h-4 w-4" />
              {selectedFiles.length > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">
                  {selectedFiles.length}
                </span>
              )}
            </Button>
            {isAgentOrAdmin && cannedResponses.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowCannedPicker(true)}
                title="Insert template"
              >
                <FileText className="mr-1 h-4 w-4" />
                Templates
              </Button>
            )}
          </div>
          {isInternalNote ? (
            <Button
              onClick={handleSend}
              disabled={!hasContent || isSending}
              size="default"
              className={
                hasContent ? "bg-amber-600 hover:bg-amber-700" : ""
              }
            >
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Add Note
                </>
              )}
            </Button>
          ) : (
            <div className="inline-flex rounded-md shadow-sm">
              <Button
                onClick={handlePrimaryClick}
                disabled={(!hasContent && !canStatusOnly) || isSending}
                size="default"
                className="rounded-r-none border-r border-blue-700/40"
              >
                {isSending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : canStatusOnly && pendingStatus ? (
                  <>
                    <span
                      className={`mr-2 h-2 w-2 rounded-full ${STATUS_DOT[pendingStatus]}`}
                    />
                    Mark as <span className="ml-1 font-semibold">{STATUS_LABEL[pendingStatus]}</span>
                  </>
                ) : pendingStatus === null ? (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Reply
                  </>
                ) : (
                  <>
                    <span
                      className={`mr-2 h-2 w-2 rounded-full ${STATUS_DOT[pendingStatus]}`}
                    />
                    Submit as <span className="ml-1 font-semibold">{STATUS_LABEL[pendingStatus]}</span>
                  </>
                )}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  disabled={isSending}
                  aria-label="Choose status to submit as"
                  render={
                    <Button
                      size="default"
                      className="rounded-l-none px-2"
                    />
                  }
                >
                  <ChevronUp className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="top" className="w-56">
                  {STATUS_OPTIONS.map((status) => (
                    <DropdownMenuItem
                      key={status}
                      onClick={() => setPendingStatus(status)}
                      className="flex items-center gap-2"
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`}
                      />
                      <span className="flex-1">{STATUS_LABEL[status]}</span>
                      {pendingStatus === status && (
                        <Check className="h-4 w-4 text-muted-foreground" />
                      )}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setPendingStatus(null)}
                    className="flex items-center gap-2"
                  >
                    <Send className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="flex-1">Send (no status change)</span>
                    {pendingStatus === null && (
                      <Check className="h-4 w-4 text-muted-foreground" />
                    )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>

      {/* Canned Response Picker Dialog */}
      {showCannedPicker && (
        <CannedResponsePicker
          responses={cannedResponses}
          onSelect={handleCannedResponseSelect}
          onClose={() => setShowCannedPicker(false)}
        />
      )}
    </div>
  )
})
