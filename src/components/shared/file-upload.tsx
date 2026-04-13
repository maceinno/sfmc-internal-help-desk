"use client"

import * as React from "react"
import {
  Upload,
  X,
  File,
  FileText,
  Image,
  Sheet,
  Video,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void
  existingFiles?: { name: string; size: number; type: string }[]
  onRemoveFile?: (index: number) => void
  maxSizeMB?: number
  accept?: string
  multiple?: boolean
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const size = bytes / Math.pow(1024, i)
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return Image
  if (type === "application/pdf" || type.startsWith("text/")) return FileText
  if (
    type.includes("spreadsheet") ||
    type.includes("excel") ||
    type === "text/csv"
  )
    return Sheet
  if (type.startsWith("video/")) return Video
  return File
}

export function FileUpload({
  onFilesSelected,
  existingFiles = [],
  onRemoveFile,
  maxSizeMB = 10,
  accept,
  multiple = true,
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const dragCounter = React.useRef(0)

  const maxSizeBytes = maxSizeMB * 1024 * 1024

  const validateAndEmit = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return

    setError(null)
    const files = Array.from(fileList)
    const oversized = files.filter((f) => f.size > maxSizeBytes)

    if (oversized.length > 0) {
      const names = oversized.map((f) => f.name).join(", ")
      setError(
        `File${oversized.length > 1 ? "s" : ""} exceed ${maxSizeMB} MB limit: ${names}`
      )
      // Still pass through valid files
      const valid = files.filter((f) => f.size <= maxSizeBytes)
      if (valid.length > 0) onFilesSelected(valid)
      return
    }

    onFilesSelected(files)
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current += 1
    if (dragCounter.current === 1) {
      setIsDragOver(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current -= 1
    if (dragCounter.current === 0) {
      setIsDragOver(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current = 0
    setIsDragOver(false)
    validateAndEmit(e.dataTransfer.files)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    validateAndEmit(e.target.files)
    // Reset so the same file can be re-selected
    if (inputRef.current) inputRef.current.value = ""
  }

  const handleClick = () => {
    inputRef.current?.click()
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Drop zone */}
      <button
        type="button"
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-sm transition-colors",
          "hover:border-primary/50 hover:bg-muted/50",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
          isDragOver
            ? "border-primary bg-primary/5 text-primary"
            : "border-muted-foreground/25 text-muted-foreground"
        )}
      >
        <Upload
          className={cn(
            "size-8",
            isDragOver ? "text-primary" : "text-muted-foreground/50"
          )}
        />
        <div className="text-center">
          <span className="font-medium text-foreground">
            Click to upload
          </span>{" "}
          or drag and drop
        </div>
        <span className="text-xs text-muted-foreground">
          Max file size: {maxSizeMB} MB
          {accept && ` (${accept})`}
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleInputChange}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* Error message */}
      {error && (
        <p className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      )}

      {/* File list */}
      {existingFiles.length > 0 && (
        <ul className="flex flex-col gap-1.5" role="list">
          {existingFiles.map((file, index) => {
            const Icon = getFileIcon(file.type)
            return (
              <li
                key={`${file.name}-${index}`}
                className="flex items-center gap-2.5 rounded-lg border bg-muted/30 px-3 py-2 text-sm"
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {file.name}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </span>
                {onRemoveFile && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => onRemoveFile(index)}
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="size-3" />
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
