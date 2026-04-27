"use client"

import * as React from "react"
import {
  Send,
  Lock,
  Paperclip,
  AtSign,
  X,
  FileText,
  Loader2,
  ChevronUp,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CannedResponsePicker } from "@/components/shared/canned-response-picker"
import { FileUpload } from "@/components/shared/file-upload"
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
// it pending on the user; everything else stays put.
function defaultNextStatus(current: TicketStatus): TicketStatus {
  switch (current) {
    case "new":
      return "open"
    case "open":
      return "pending"
    case "solved":
      return "open"
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
  onCannedResponseSelect?: (response: CannedResponse) => void
}

export interface ReplyComposerHandle {
  addFiles: (files: File[]) => void
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
  onCannedResponseSelect,
}, ref) {
  const [replyText, setReplyText] = React.useState("")
  const [isInternalNote, setIsInternalNote] = React.useState(false)
  const [showMentionDropdown, setShowMentionDropdown] = React.useState(false)
  const [mentionSearch, setMentionSearch] = React.useState("")
  const [taggedInMessage, setTaggedInMessage] = React.useState<string[]>([])
  const [showCannedPicker, setShowCannedPicker] = React.useState(false)
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([])
  const [showFileUpload, setShowFileUpload] = React.useState(false)
  const [pendingCannedResponseId, setPendingCannedResponseId] = React.useState<string | undefined>()
  const [isSending, setIsSending] = React.useState(false)
  // null = "Send (no status change)"; otherwise the status the reply will commit.
  const [pendingStatus, setPendingStatus] = React.useState<TicketStatus | null>(
    () => defaultNextStatus(currentStatus),
  )
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  const isAgentOrAdmin =
    currentUser.role === "agent" || currentUser.role === "admin"

  // Re-baseline the suggested next-status when the ticket's current status
  // changes from outside (e.g., assignee changed status via the sidebar).
  // Skip if the user has explicitly chosen "no status change" (null).
  const lastCurrentStatusRef = React.useRef(currentStatus)
  React.useEffect(() => {
    if (lastCurrentStatusRef.current !== currentStatus) {
      lastCurrentStatusRef.current = currentStatus
      setPendingStatus((prev) =>
        prev === null ? null : defaultNextStatus(currentStatus),
      )
    }
  }, [currentStatus])

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setReplyText(value)

    const cursorPosition = e.target.selectionStart
    const textBeforeCursor = value.slice(0, cursorPosition)
    const match = textBeforeCursor.match(/@(\w*)$/)

    if (match) {
      setShowMentionDropdown(true)
      setMentionSearch(match[1].toLowerCase())
    } else {
      setShowMentionDropdown(false)
    }
  }

  const handleSelectMention = (user: User) => {
    if (!textareaRef.current) return

    const cursorPosition = textareaRef.current.selectionStart
    const textBeforeCursor = replyText.slice(0, cursorPosition)
    const textAfterCursor = replyText.slice(cursorPosition)

    const newTextBeforeCursor = textBeforeCursor.replace(
      /@\w*$/,
      `@${user.name} `
    )
    setReplyText(newTextBeforeCursor + textAfterCursor)

    if (!taggedInMessage.includes(user.id)) {
      setTaggedInMessage([...taggedInMessage, user.id])
    }
    setShowMentionDropdown(false)

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        const newCursorPos = newTextBeforeCursor.length
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
      }
    }, 0)
  }

  const handleRemoveTag = (userId: string) => {
    setTaggedInMessage(taggedInMessage.filter((id) => id !== userId))
  }

  const handleSend = async () => {
    if (!replyText.trim() || isSending) return
    setIsSending(true)
    try {
      await onSubmit({
        content: replyText,
        isInternal: isInternalNote,
        taggedAgents: taggedInMessage.length > 0 ? taggedInMessage : undefined,
        attachments: selectedFiles.length > 0 ? selectedFiles : undefined,
        cannedResponseId: pendingCannedResponseId,
        // Internal notes never change status.
        nextStatus: isInternalNote ? null : pendingStatus,
      })
      setReplyText("")
      setTaggedInMessage([])
      setSelectedFiles([])
      setShowFileUpload(false)
      setPendingCannedResponseId(undefined)
    } finally {
      setIsSending(false)
    }
  }

  const handleCannedResponseSelect = (response: CannedResponse) => {
    const processedContent = response.content
      .replace(/\{\{requester_name\}\}/g, users.find((u) => u.id === ticketCreatedBy)?.name || "Customer")
      .replace(/\{\{agent_name\}\}/g, currentUser.name)
      .replace(/\{\{ticket_id\}\}/g, ticketId)

    setReplyText((prev) =>
      prev ? prev + "\n\n" + processedContent : processedContent
    )
    setShowCannedPicker(false)
    setPendingCannedResponseId(response.id)
    onCannedResponseSelect?.(response)
  }

  const filteredMentionUsers = React.useMemo(() => {
    return users
      .filter((u) => {
        if (u.id === currentUser.id) return false
        if (isInternalNote) return u.role !== "employee"
        if (u.role !== "employee") return true
        const isCreator = u.id === ticketCreatedBy
        const isCcd = ticketCc.includes(u.id)
        const isCollaborator = ticketCollaborators.includes(u.id)
        return isCreator || isCcd || isCollaborator
      })
      .filter(
        (u) =>
          u.name.toLowerCase().includes(mentionSearch) ||
          u.email.toLowerCase().includes(mentionSearch)
      )
  }, [users, currentUser.id, isInternalNote, mentionSearch, ticketCreatedBy, ticketCc, ticketCollaborators])

  const handleFilesSelected = (files: File[]) => {
    setSelectedFiles((prev) => [...prev, ...files])
  }

  React.useImperativeHandle(ref, () => ({
    addFiles: (files: File[]) => {
      if (files.length === 0) return
      setSelectedFiles((prev) => [...prev, ...files])
      setShowFileUpload(true)
    },
  }))

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handlePaste = React.useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      const imageFiles: File[] = []
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile()
          if (file) {
            // Give pasted images a readable name
            const ext = file.type.split("/")[1] ?? "png"
            const named = new File(
              [file],
              `pasted-image-${Date.now()}.${ext}`,
              { type: file.type }
            )
            imageFiles.push(named)
          }
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault()
        setSelectedFiles((prev) => [...prev, ...imageFiles])
        setShowFileUpload(true)
      }
    },
    []
  )

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

        {/* Textarea */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={replyText}
            onChange={handleTextChange}
            onPaste={handlePaste}
            placeholder={
              isInternalNote
                ? "Add an internal note... (Type @ to tag an agent)"
                : "Type your reply... (Type @ to tag a user, paste images)"
            }
            className={`min-h-[120px] w-full resize-none p-3 outline-none text-sm ${
              isInternalNote ? "bg-amber-50/30" : "bg-white"
            }`}
          />

          {/* Mention Dropdown */}
          {showMentionDropdown && (
            <div className="absolute bottom-full left-4 z-10 mb-2 w-64 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
              <div className="max-h-48 overflow-y-auto py-1">
                {filteredMentionUsers.length > 0 ? (
                  filteredMentionUsers.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleSelectMention(user)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-gray-50"
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
                        <p className="truncate text-xs text-muted-foreground capitalize">
                          {user.role}
                        </p>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-center text-sm text-muted-foreground">
                    {isInternalNote ? "No agents found" : "No users found"}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Tagged Users Chips */}
        {taggedInMessage.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-gray-100 bg-white px-3 py-2">
            {taggedInMessage.map((userId) => {
              const user = users.find((u) => u.id === userId)
              if (!user) return null
              return (
                <div
                  key={userId}
                  className="flex items-center gap-1.5 rounded-md border border-blue-100 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700"
                >
                  <AtSign className="h-3 w-3 text-blue-500" />
                  <Avatar size="sm" className="h-4 w-4">
                    {user.avatar_url && (
                      <AvatarImage src={user.avatar_url} alt="" />
                    )}
                    <AvatarFallback className="text-[8px]">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  {user.name}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(userId)}
                    className="ml-1 text-blue-400 hover:text-blue-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )
            })}
          </div>
        )}

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
              disabled={!replyText.trim() || isSending}
              size="default"
              className={
                replyText.trim() ? "bg-amber-600 hover:bg-amber-700" : ""
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
                onClick={handleSend}
                disabled={!replyText.trim() || isSending}
                size="default"
                className="rounded-r-none border-r border-blue-700/40"
              >
                {isSending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
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
                      onSelect={() => setPendingStatus(status)}
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
                    onSelect={() => setPendingStatus(null)}
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
