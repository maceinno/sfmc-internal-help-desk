"use client"

import * as React from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import Link from "@tiptap/extension-link"
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Link as LinkIcon,
  Strikethrough,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { sanitizeRichHtml } from "@/lib/html/sanitize"

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
  ariaInvalid?: boolean
  id?: string
  /** Roughly the visible height in lines; passes through to min-h on the editor area. */
  minRows?: number
}

/**
 * Tiptap-based rich-text editor with a small toolbar. Stores sanitized
 * HTML and emits it through `onChange` whenever content updates. Intended
 * for ticket descriptions and reply bodies — no media, no recording, just
 * formatting.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder,
  className,
  ariaInvalid,
  id,
  minRows = 6,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // The starter kit ships a Heading we don't expose in the toolbar;
        // disabling keeps surprises out of pasted content.
        heading: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
    ],
    content: value || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        id: id ?? "",
        class: cn(
          "prose prose-sm max-w-none px-3 py-2 outline-none focus:outline-none",
          "[&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1",
        ),
        "data-placeholder": placeholder ?? "",
        "aria-invalid": ariaInvalid ? "true" : "false",
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      // Tiptap spits out <p></p> for an empty doc; treat as truly empty.
      if (html === "<p></p>") {
        onChange("")
        return
      }
      onChange(sanitizeRichHtml(html))
    },
  })

  // Keep external resets in sync (e.g., form.reset()).
  React.useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    const next = value || ""
    if (current === next) return
    if (current === "<p></p>" && next === "") return
    editor.commands.setContent(next, { emitUpdate: false })
  }, [editor, value])

  const handleAddLink = React.useCallback(() => {
    if (!editor) return
    const previous = editor.getAttributes("link").href ?? ""
    const url = window.prompt("Link URL", previous)
    if (url === null) return
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
      return
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run()
  }, [editor])

  if (!editor) return null

  const ToolbarBtn = ({
    onClick,
    active,
    label,
    children,
  }: {
    onClick: () => void
    active?: boolean
    label: string
    children: React.ReactNode
  }) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors",
        active
          ? "bg-blue-100 text-blue-700"
          : "hover:bg-gray-100 hover:text-gray-900",
      )}
    >
      {children}
    </button>
  )

  return (
    <div
      className={cn(
        "rounded-md border border-input bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring/50",
        ariaInvalid && "border-destructive",
        className,
      )}
    >
      <div className="flex items-center gap-0.5 border-b border-input bg-gray-50/60 px-1 py-1">
        <ToolbarBtn
          label="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          label="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          label="Underline"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          label="Strikethrough"
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <span className="mx-1 h-4 w-px bg-gray-300" aria-hidden />
        <ToolbarBtn
          label="Bulleted list"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          label="Numbered list"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <span className="mx-1 h-4 w-px bg-gray-300" aria-hidden />
        <ToolbarBtn
          label="Link"
          active={editor.isActive("link")}
          onClick={handleAddLink}
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </ToolbarBtn>
      </div>
      <EditorContent
        editor={editor}
        className={cn("text-sm")}
        style={{ minHeight: `${minRows * 1.5}rem` }}
      />
      {editor.isEmpty && placeholder && (
        <div
          className="pointer-events-none -mt-[1.75rem] px-3 text-sm text-muted-foreground"
          aria-hidden
        >
          {placeholder}
        </div>
      )}
    </div>
  )
}
