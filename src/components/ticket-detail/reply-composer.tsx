"use client"

import * as React from "react"
import {
  Send,
  Lock,
  Paperclip,
  AtSign,
  X,
  FileText,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { CannedResponsePicker } from "@/components/shared/canned-response-picker"
import { FileUpload } from "@/components/shared/file-upload"
import type { User, CannedResponse, Message } from "@/types"

interface ReplyComposerProps {
  ticketId: string
  ticketCreatedBy: string
  ticketCc?: string[]
  ticketCollaborators?: string[]
  users: User[]
  currentUser: User
  cannedResponses?: CannedResponse[]
  onSubmit: (message: {
    content: string
    isInternal: boolean
    taggedAgents?: string[]
    attachments?: File[]
  }) => void
  onCannedResponseSelect?: (response: CannedResponse) => void
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

export function ReplyComposer({
  ticketId,
  ticketCreatedBy,
  ticketCc = [],
  ticketCollaborators = [],
  users,
  currentUser,
  cannedResponses = [],
  onSubmit,
  onCannedResponseSelect,
}: ReplyComposerProps) {
  const [replyText, setReplyText] = React.useState("")
  const [isInternalNote, setIsInternalNote] = React.useState(false)
  const [showMentionDropdown, setShowMentionDropdown] = React.useState(false)
  const [mentionSearch, setMentionSearch] = React.useState("")
  const [taggedInMessage, setTaggedInMessage] = React.useState<string[]>([])
  const [showCannedPicker, setShowCannedPicker] = React.useState(false)
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([])
  const [showFileUpload, setShowFileUpload] = React.useState(false)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  const isAgentOrAdmin =
    currentUser.role === "agent" || currentUser.role === "admin"

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

  const handleSend = () => {
    if (!replyText.trim()) return
    onSubmit({
      content: replyText,
      isInternal: isInternalNote,
      taggedAgents: taggedInMessage.length > 0 ? taggedInMessage : undefined,
      attachments: selectedFiles.length > 0 ? selectedFiles : undefined,
    })
    setReplyText("")
    setTaggedInMessage([])
    setSelectedFiles([])
    setShowFileUpload(false)
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
    onCannedResponseSelect?.(response)
  }

  const filteredMentionUsers = React.useMemo(() => {
    return users
      .filter((u) => {
        if (u.id === currentUser.id) return false
        if (isInternalNote) return u.role !== "employee"
        if (u.role !== "employee") return true
        const isCreator = u.id === ticketCreatedBy
        const isCcd = ticketCc.includes(u.email)
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

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="border-t border-gray-100 bg-gray-50 p-4">
      <div
        className={`overflow-hidden rounded-lg border bg-white shadow-sm transition-all focus-within:ring-2 ${
          isInternalNote
            ? "border-amber-300 focus-within:ring-amber-200"
            : "border-gray-300 focus-within:ring-blue-500"
        }`}
      >
        {/* Toggle Tabs */}
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-3 py-2">
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
            placeholder={
              isInternalNote
                ? "Add an internal note... (Type @ to tag an agent)"
                : "Type your reply... (Type @ to tag a user)"
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

        {/* File Upload Area */}
        {showFileUpload && (
          <div className="border-t border-gray-100 px-3 py-2">
            <FileUpload
              onFilesSelected={handleFilesSelected}
              existingFiles={selectedFiles.map((f) => ({
                name: f.name,
                size: f.size,
                type: f.type,
              }))}
              onRemoveFile={handleRemoveFile}
            />
          </div>
        )}

        {/* Bottom Bar */}
        <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/50 px-3 py-2">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowFileUpload(!showFileUpload)}
              title="Attach file"
            >
              <Paperclip className="h-4 w-4" />
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
          <Button
            onClick={handleSend}
            disabled={!replyText.trim()}
            size="default"
            className={
              isInternalNote && replyText.trim()
                ? "bg-amber-600 hover:bg-amber-700"
                : ""
            }
          >
            <Send className="mr-2 h-4 w-4" />
            {isInternalNote ? "Add Note" : "Send Reply"}
          </Button>
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
}
