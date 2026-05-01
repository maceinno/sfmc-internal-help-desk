"use client"

import * as React from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import Link from "@tiptap/extension-link"
import Mention from "@tiptap/extension-mention"
import Placeholder from "@tiptap/extension-placeholder"
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

interface MentionCandidate {
  id: string
  name: string
  email?: string
}

interface MentionState {
  items: MentionCandidate[]
  selectedIndex: number
  command: ((item: { id: string; label: string }) => void) | null
  position: { top: number; left: number } | null
}

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
  ariaInvalid?: boolean
  id?: string
  /** Roughly the visible height in lines; passes through to min-h on the editor area. */
  minRows?: number
  /**
   * If provided, image files pasted into the editor are intercepted and
   * forwarded here instead of being inserted inline. Used by the reply
   * composer to attach pasted screenshots as files rather than embedding
   * them in the message HTML.
   */
  onPasteFiles?: (files: File[]) => void
  /**
   * If provided, enables `@`-trigger mentions. Typing `@` opens a popup
   * with the candidates filtered by the typed query. Selected mentions
   * insert as <span data-type="mention" data-id="<id>">@Name</span> and
   * survive sanitization. Pass an empty array to render the editor with
   * the popup wired but no candidates (the popup just won't open).
   */
  mentionUsers?: MentionCandidate[]
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
  onPasteFiles,
  mentionUsers,
}: RichTextEditorProps) {
  // Keep the latest paste-handler in a ref so the editor's options object
  // doesn't have to re-init when callers pass an unstable callback.
  const pasteFilesRef = React.useRef(onPasteFiles)
  React.useEffect(() => {
    pasteFilesRef.current = onPasteFiles
  }, [onPasteFiles])

  // Mention candidate list lives in a ref for the same reason — useEditor
  // initializes options once and we want the suggestion items() callback
  // to always see the freshest user list.
  const mentionUsersRef = React.useRef<MentionCandidate[]>(mentionUsers ?? [])
  React.useEffect(() => {
    mentionUsersRef.current = mentionUsers ?? []
  }, [mentionUsers])

  // Popup state for the @-mention picker. Driven by the suggestion lifecycle
  // callbacks below; rendered as an absolutely-positioned floating panel.
  const [mentionState, setMentionState] = React.useState<MentionState | null>(null)
  // Track selected index in a ref too so onKeyDown sees current value
  // synchronously without stale closure issues.
  const selectedIndexRef = React.useRef(0)

  const containerRef = React.useRef<HTMLDivElement>(null)

  // Track the last HTML we emitted via onChange so the value-sync effect
  // below can tell "value changed because of our own keystroke" apart from
  // "value changed externally (form reset, canned response insert)". Without
  // this guard, sanitizeRichHtml's round-trip can produce HTML that differs
  // byte-for-byte from editor.getHTML() (whitespace normalization, attribute
  // ordering), which then triggers setContent on every keystroke and eats
  // the character the user just typed.
  const lastEmittedRef = React.useRef<string>(value || "")

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // The starter kit ships a Heading we don't expose in the toolbar;
        // disabling keeps surprises out of pasted content.
        heading: false,
      }),
      Underline,
      Placeholder.configure({
        placeholder: placeholder ?? "",
        // Render the placeholder as a CSS ::before pseudo-element on the
        // first empty paragraph (default behavior). Click-anywhere focus
        // works because the editor's contenteditable owns its full min-h.
        showOnlyCurrent: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      ...(mentionUsers
        ? [
            Mention.configure({
              HTMLAttributes: { class: "mention" },
              renderHTML({ options, node }) {
                return [
                  "span",
                  {
                    "data-type": "mention",
                    "data-id": node.attrs.id,
                    "data-label": node.attrs.label,
                    class: options.HTMLAttributes.class,
                  },
                  `@${node.attrs.label}`,
                ]
              },
              suggestion: {
                char: "@",
                allowSpaces: false,
                items: ({ query }) => {
                  const q = query.trim().toLowerCase()
                  if (!q) return mentionUsersRef.current.slice(0, 6)
                  return mentionUsersRef.current
                    .filter(
                      (u) =>
                        u.name.toLowerCase().includes(q) ||
                        (u.email ?? "").toLowerCase().includes(q),
                    )
                    .slice(0, 6)
                },
                render: () => {
                  // Suggestion's onKeyDown only receives the event; the
                  // current items + command live on onStart/onUpdate's
                  // props. Capture them in closure variables so we can
                  // use them from inside onKeyDown.
                  let currentItems: MentionCandidate[] = []
                  let currentCommand:
                    | ((item: { id: string; label: string }) => void)
                    | null = null
                  const computePosition = (
                    rect: DOMRect | null | undefined,
                  ): { top: number; left: number } | null => {
                    if (!rect) return null
                    // Position below the cursor, in viewport coordinates
                    // (we use position: fixed on the popup).
                    return {
                      top: rect.bottom + 4,
                      left: rect.left,
                    }
                  }
                  return {
                    onStart: (props) => {
                      currentItems = props.items as MentionCandidate[]
                      currentCommand = props.command
                      selectedIndexRef.current = 0
                      setMentionState({
                        items: currentItems,
                        selectedIndex: 0,
                        command: currentCommand,
                        position: computePosition(props.clientRect?.()),
                      })
                    },
                    onUpdate: (props) => {
                      currentItems = props.items as MentionCandidate[]
                      currentCommand = props.command
                      // Reset selection if it'd be out of bounds after a re-filter.
                      if (selectedIndexRef.current >= currentItems.length) {
                        selectedIndexRef.current = 0
                      }
                      setMentionState({
                        items: currentItems,
                        selectedIndex: selectedIndexRef.current,
                        command: currentCommand,
                        position: computePosition(props.clientRect?.()),
                      })
                    },
                    onKeyDown: ({ event }) => {
                      if (event.key === "Escape") {
                        setMentionState(null)
                        return true
                      }
                      if (currentItems.length === 0) return false
                      if (event.key === "ArrowDown") {
                        selectedIndexRef.current =
                          (selectedIndexRef.current + 1) % currentItems.length
                        setMentionState((s) =>
                          s
                            ? { ...s, selectedIndex: selectedIndexRef.current }
                            : null,
                        )
                        return true
                      }
                      if (event.key === "ArrowUp") {
                        selectedIndexRef.current =
                          (selectedIndexRef.current -
                            1 +
                            currentItems.length) %
                          currentItems.length
                        setMentionState((s) =>
                          s
                            ? { ...s, selectedIndex: selectedIndexRef.current }
                            : null,
                        )
                        return true
                      }
                      if (event.key === "Enter" || event.key === "Tab") {
                        const item = currentItems[selectedIndexRef.current]
                        if (item && currentCommand) {
                          currentCommand({ id: item.id, label: item.name })
                          return true
                        }
                      }
                      return false
                    },
                    onExit: () => {
                      setMentionState(null)
                    },
                  }
                },
              },
            }),
          ]
        : []),
    ],
    content: value || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        id: id ?? "",
        class: cn(
          "prose prose-sm max-w-none px-3 py-2 outline-none focus:outline-none",
          "[&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1",
          "[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6",
          "[&_.mention]:bg-blue-100 [&_.mention]:text-blue-700 [&_.mention]:rounded [&_.mention]:px-1 [&_.mention]:font-medium",
        ),
        // min-h on the contenteditable itself so clicking anywhere in
        // the visible editor area lands the cursor (instead of just the
        // wrapper div absorbing the click).
        style: `min-height: ${minRows * 1.5}rem`,
        "aria-invalid": ariaInvalid ? "true" : "false",
      },
      handlePaste: (_view, event) => {
        const handler = pasteFilesRef.current
        if (!handler) return false
        const items = event.clipboardData?.items
        if (!items) return false
        const files: File[] = []
        for (const item of Array.from(items)) {
          if (item.type.startsWith("image/")) {
            const file = item.getAsFile()
            if (file) {
              const ext = file.type.split("/")[1] ?? "png"
              files.push(
                new File([file], `pasted-image-${Date.now()}.${ext}`, {
                  type: file.type,
                }),
              )
            }
          }
        }
        if (files.length === 0) return false
        handler(files)
        return true
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      // Tiptap spits out <p></p> for an empty doc; treat as truly empty.
      if (html === "<p></p>") {
        lastEmittedRef.current = ""
        onChange("")
        return
      }
      const sanitized = sanitizeRichHtml(html)
      lastEmittedRef.current = sanitized
      onChange(sanitized)
    },
  })

  // Keep external resets in sync (e.g., form.reset(), canned-response insert).
  // Only run setContent when the incoming value didn't come from our own
  // onUpdate — otherwise sanitizer round-trip differences would clobber the
  // editor mid-keystroke.
  React.useEffect(() => {
    if (!editor) return
    const next = value || ""
    if (next === lastEmittedRef.current) return
    const current = editor.getHTML()
    if (current === next) return
    if (current === "<p></p>" && next === "") return
    lastEmittedRef.current = next
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
      ref={containerRef}
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
      <EditorContent editor={editor} className={cn("text-sm")} />

      {mentionState && mentionState.position && mentionState.items.length > 0 && (
        <div
          className="fixed z-50 max-h-64 w-64 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg"
          style={{
            top: mentionState.position.top,
            left: mentionState.position.left,
          }}
        >
          {mentionState.items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onMouseDown={(e) => {
                // Prevent the editor losing focus before command fires.
                e.preventDefault()
                mentionState.command?.({ id: item.id, label: item.name })
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                i === mentionState.selectedIndex
                  ? "bg-blue-50"
                  : "hover:bg-gray-50",
              )}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                {item.name
                  .split(/\s+/)
                  .map((p) => p[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-gray-900">
                  {item.name}
                </span>
                {item.email && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.email}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
