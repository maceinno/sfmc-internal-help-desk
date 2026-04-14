"use client"

import * as React from "react"
import { ArrowUpDown, Lock, Paperclip, Search, Download } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Message, Attachment, User } from "@/types"

interface MessageThreadProps {
  messages: Message[]
  users: User[]
  currentUserId: string
  ticketDescription: string
  ticketCreatedBy: string
  ticketCreatedAt: string
  attachments?: Attachment[]
  onImageClick?: (url: string, fileName: string) => void
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

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const size = bytes / Math.pow(1024, i)
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function MessageThread({
  messages,
  users,
  currentUserId,
  ticketDescription,
  ticketCreatedBy,
  ticketCreatedAt,
  attachments = [],
  onImageClick,
}: MessageThreadProps) {
  const [sortOrder, setSortOrder] = React.useState<"oldest" | "newest">(
    "oldest"
  )

  const getUser = React.useCallback(
    (userId: string) => users.find((u) => u.id === userId),
    [users]
  )

  const creator = getUser(ticketCreatedBy)

  const sortedMessages = React.useMemo(() => {
    return [...messages].sort((a, b) => {
      const timeA = new Date(a.created_at).getTime()
      const timeB = new Date(b.created_at).getTime()
      return sortOrder === "oldest" ? timeA - timeB : timeB - timeA
    })
  }, [messages, sortOrder])

  const renderOriginalRequest = () => (
    <div className="flex gap-4">
      <div className="shrink-0">
        <Avatar>
          {creator?.avatar_url && (
            <AvatarImage src={creator.avatar_url} alt={creator?.name} />
          )}
          <AvatarFallback>
            {getInitials(creator?.name ?? "?")}
          </AvatarFallback>
        </Avatar>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900">
              {creator?.name ?? "Unknown"}
            </span>
            {sortOrder === "newest" && (
              <Badge variant="secondary" className="text-[10px]">
                Original Request
              </Badge>
            )}
          </div>
          <span className="text-sm text-muted-foreground">
            {new Date(ticketCreatedAt).toLocaleString()}
          </span>
        </div>
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 text-gray-800">
          <p className="whitespace-pre-wrap">{ticketDescription}</p>
        </div>
      </div>
    </div>
  )

  const renderMessageAttachments = (messageId: string) => {
    const messageAttachments = attachments.filter(
      (att) => att.message_id === messageId
    )
    if (messageAttachments.length === 0) return null

    const images = messageAttachments.filter(
      (att) => att.file_type.startsWith("image/") && att.url
    )
    const files = messageAttachments.filter(
      (att) => !(att.file_type.startsWith("image/") && att.url)
    )

    return (
      <div className="mt-3 space-y-2">
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {images.map((att) => (
              <button
                key={att.id}
                type="button"
                onClick={() => onImageClick?.(att.url!, att.file_name)}
                className="group relative overflow-hidden rounded-lg border border-gray-200 transition-all hover:border-blue-400 hover:shadow-md"
              >
                <img
                  src={att.url}
                  alt={att.file_name}
                  className="h-24 w-36 object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
                  <Search className="h-4 w-4 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1">
                  <p className="truncate text-[10px] text-white">
                    {att.file_name}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {files.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {files.map((att) => (
              <div
                key={att.id}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 transition-colors hover:border-gray-300"
              >
                <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="max-w-[180px] truncate text-xs font-medium text-gray-900">
                    {att.file_name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatFileSize(att.file_size)}
                    {att.version && <span className="ml-1">v{att.version}</span>}
                  </p>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-blue-600"
                  title={`Download ${att.file_name}`}
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const renderMessage = (message: Message) => {
    const author = getUser(message.author_id)

    return (
      <div
        key={message.id}
        className={
          message.is_internal
            ? "-mx-6 border-y border-amber-100 bg-amber-50/50 px-6 py-4"
            : ""
        }
      >
        <div className="flex gap-4">
          <div className="shrink-0">
            <Avatar>
              {author?.avatar_url && (
                <AvatarImage src={author.avatar_url} alt={author?.name} />
              )}
              <AvatarFallback>
                {getInitials(author?.name ?? "?")}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">
                  {author?.name ?? "Unknown"}
                </span>
                {message.is_internal && (
                  <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    <Lock className="h-3 w-3" /> Internal Note
                  </span>
                )}
              </div>
              <span className="text-sm text-muted-foreground">
                {new Date(message.created_at).toLocaleString()}
              </span>
            </div>
            <div className="text-gray-800">
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
            {renderMessageAttachments(message.id)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Sort Toggle Bar */}
      {messages.length > 0 && (
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 bg-white px-6 py-2.5">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Conversation &bull; {messages.length}{" "}
            {messages.length === 1 ? "reply" : "replies"}
          </span>
          <Button
            variant="ghost"
            size="xs"
            onClick={() =>
              setSortOrder((prev) =>
                prev === "oldest" ? "newest" : "oldest"
              )
            }
          >
            <ArrowUpDown className="mr-1.5 h-3 w-3" />
            {sortOrder === "oldest" ? "Oldest First" : "Newest First"}
          </Button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 space-y-8 overflow-y-auto p-6">
        {sortOrder === "oldest" && renderOriginalRequest()}
        {sortedMessages.map(renderMessage)}
        {sortOrder === "newest" && renderOriginalRequest()}
      </div>
    </div>
  )
}
