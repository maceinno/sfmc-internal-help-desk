"use client"

import * as React from "react"
import {
  Paperclip,
  Download,
  ChevronRight,
  CheckCircle,
  Search,
  X,
  FileText,
  Image as ImageIcon,
  Sheet,
  Film,
  Music,
  Archive,
  File,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Attachment, User } from "@/types"

interface AttachmentListProps {
  attachments: Attachment[]
  users: User[]
  onImageClick?: (url: string, fileName: string) => void
}

function getFileIcon(fileType: string) {
  if (
    fileType.includes("pdf") ||
    fileType.includes("document") ||
    fileType.includes("word")
  )
    return FileText
  if (fileType.includes("image") || fileType.includes("eps")) return ImageIcon
  if (
    fileType.includes("sheet") ||
    fileType.includes("excel") ||
    fileType.includes("csv")
  )
    return Sheet
  if (fileType.includes("video") || fileType.includes("mp4")) return Film
  if (fileType.includes("audio") || fileType.includes("mp3")) return Music
  if (
    fileType.includes("zip") ||
    fileType.includes("compressed") ||
    fileType.includes("archive")
  )
    return Archive
  return File
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B"
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB"
  return (bytes / (1024 * 1024)).toFixed(1) + " MB"
}

function groupAttachments(attachments: Attachment[]) {
  const grouped = new Map<string, Attachment[]>()
  const ungrouped: Attachment[] = []

  for (const att of attachments) {
    if (att.versionGroup) {
      const group = grouped.get(att.versionGroup) || []
      group.push(att)
      grouped.set(att.versionGroup, group)
    } else {
      ungrouped.push(att)
    }
  }

  // Sort each group by version descending
  grouped.forEach((files, key) => {
    grouped.set(
      key,
      files.sort((a, b) => (b.version || 0) - (a.version || 0))
    )
  })

  return { grouped, ungrouped }
}

export function AttachmentList({
  attachments,
  users,
  onImageClick,
}: AttachmentListProps) {
  const [expandedVersionGroups, setExpandedVersionGroups] = React.useState<
    Set<string>
  >(new Set())
  const [lightboxImage, setLightboxImage] = React.useState<{
    url: string
    fileName: string
  } | null>(null)

  const getUser = React.useCallback(
    (userId: string) => users.find((u) => u.id === userId),
    [users]
  )

  const { grouped: versionGroups, ungrouped: ungroupedAttachments } =
    React.useMemo(() => groupAttachments(attachments), [attachments])

  const toggleVersionGroup = (groupName: string) => {
    setExpandedVersionGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupName)) {
        next.delete(groupName)
      } else {
        next.add(groupName)
      }
      return next
    })
  }

  const handleImageClick = (url: string, fileName: string) => {
    if (onImageClick) {
      onImageClick(url, fileName)
    } else {
      setLightboxImage({ url, fileName })
    }
  }

  if (attachments.length === 0) return null

  const imageAttachments = attachments.filter(
    (att) => att.fileType.startsWith("image/") && att.url
  )

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-gray-700">
            Attachments ({attachments.length})
          </span>
        </div>

        {/* Inline Image Thumbnails */}
        {imageAttachments.length > 0 && (
          <div className="flex flex-wrap gap-3 border-b border-gray-100 p-4">
            {imageAttachments.map((att) => (
              <button
                key={att.id}
                type="button"
                onClick={() => handleImageClick(att.url!, att.fileName)}
                className="group relative overflow-hidden rounded-lg border border-gray-200 transition-all hover:border-blue-400 hover:shadow-md"
              >
                <img
                  src={att.url}
                  alt={att.fileName}
                  className="h-28 w-40 object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
                  <Search className="h-5 w-5 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                  <p className="truncate text-xs text-white">{att.fileName}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Version Groups */}
        {versionGroups.size > 0 && (
          <div className="divide-y divide-gray-100">
            {Array.from(versionGroups.entries()).map(
              ([groupName, files]) => {
                const isExpanded = expandedVersionGroups.has(groupName)
                const finalFile = files.find((f) => f.isFinal)
                const latestFile = files[0]
                const displayFile = finalFile || latestFile
                const olderFiles = files.filter(
                  (f) => f.id !== displayFile.id
                )
                const Icon = getFileIcon(displayFile.fileType)

                return (
                  <div key={groupName}>
                    <div className="px-4 py-3 transition-colors hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                              displayFile.isFinal
                                ? "bg-green-50 text-green-600"
                                : "bg-blue-50 text-blue-600"
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-medium text-gray-900">
                                {displayFile.fileName}
                              </p>
                              {displayFile.isFinal ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                                  <CheckCircle className="h-3 w-3" />
                                  Final
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                                  v{displayFile.version || 1} -- Latest
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(displayFile.fileSize)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-blue-50 hover:text-blue-600"
                            title={`Download ${displayFile.fileName}`}
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          {olderFiles.length > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleVersionGroup(groupName)}
                              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-gray-100 hover:text-gray-600"
                              title={
                                isExpanded
                                  ? "Hide version history"
                                  : `Show ${olderFiles.length} older version${olderFiles.length !== 1 ? "s" : ""}`
                              }
                            >
                              <ChevronRight
                                className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                              />
                            </button>
                          )}
                        </div>
                      </div>
                      {olderFiles.length > 0 && !isExpanded && (
                        <button
                          type="button"
                          onClick={() => toggleVersionGroup(groupName)}
                          className="ml-12 mt-1 text-xs text-blue-500 hover:text-blue-700 hover:underline"
                        >
                          +{olderFiles.length} older version
                          {olderFiles.length !== 1 ? "s" : ""}
                        </button>
                      )}
                    </div>

                    {/* Older versions */}
                    {isExpanded &&
                      olderFiles.map((att) => {
                        const uploader = getUser(att.uploadedBy)
                        const OlderIcon = getFileIcon(att.fileType)
                        return (
                          <div
                            key={att.id}
                            className="flex items-center justify-between border-t border-gray-100 bg-gray-50/50 py-2.5 pl-8 pr-4 transition-colors hover:bg-gray-100/50"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-muted-foreground">
                                <OlderIcon className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="truncate text-sm text-gray-600">
                                    {att.fileName}
                                  </p>
                                  <span className="text-xs text-muted-foreground">
                                    v{att.version || 1}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {formatFileSize(att.fileSize)}
                                  {uploader && (
                                    <span> &bull; {uploader.name}</span>
                                  )}
                                  {att.uploadedAt && (
                                    <span>
                                      {" "}
                                      &bull;{" "}
                                      {new Date(
                                        att.uploadedAt
                                      ).toLocaleDateString()}
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-blue-50 hover:text-blue-600"
                              title={`Download ${att.fileName}`}
                            >
                              <Download className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )
                      })}
                  </div>
                )
              }
            )}
          </div>
        )}

        {/* Ungrouped Files */}
        {ungroupedAttachments.length > 0 && (
          <div
            className={`divide-y divide-gray-100 ${versionGroups.size > 0 ? "border-t border-gray-200" : ""}`}
          >
            {ungroupedAttachments.map((att) => {
              const uploader = getUser(att.uploadedBy)
              const isImage =
                att.fileType.startsWith("image/") && att.url
              const Icon = getFileIcon(att.fileType)

              return (
                <div
                  key={att.id}
                  className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-gray-50"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {isImage ? (
                      <button
                        type="button"
                        onClick={() =>
                          handleImageClick(att.url!, att.fileName)
                        }
                        className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-gray-200 transition-colors hover:border-blue-400"
                      >
                        <img
                          src={att.url}
                          alt={att.fileName}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                        <Icon className="h-4 w-4" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {att.fileName}
                        {isImage && (
                          <span className="ml-1.5 text-xs font-normal text-blue-500">
                            (click to preview)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(att.fileSize)}
                        {uploader && (
                          <span>
                            {" "}
                            &bull; Uploaded by {uploader.name}
                          </span>
                        )}
                        {att.uploadedAt && (
                          <span>
                            {" "}
                            &bull;{" "}
                            {new Date(att.uploadedAt).toLocaleDateString()}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="ml-3 shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-blue-50 hover:text-blue-600"
                    title={`Download ${att.fileName}`}
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Image Lightbox */}
      {lightboxImage && (
        <Dialog
          open={!!lightboxImage}
          onOpenChange={(open) => !open && setLightboxImage(null)}
        >
          <DialogContent className="sm:max-w-3xl p-0 overflow-hidden">
            <DialogHeader className="px-4 pt-4 pb-0">
              <DialogTitle>{lightboxImage.fileName}</DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center p-4">
              <img
                src={lightboxImage.url}
                alt={lightboxImage.fileName}
                className="max-h-[70vh] max-w-full rounded-lg object-contain"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
