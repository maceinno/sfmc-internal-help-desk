"use client"

import * as React from "react"
import { Check, Pencil, X } from "lucide-react"

/**
 * The ticket subject, editable in place.
 *
 * Subjects are often written in a hurry ("help", "question") or typed against
 * the wrong loan, and until now they were fixed for the life of the ticket.
 * Editing happens inline rather than in a dialog so the change reads as a
 * small correction, which is what it usually is.
 *
 * Deliberately no native confirm()/alert() anywhere in here — those are
 * suppressed inside the workspace preview pane, so a control gated on one
 * silently does nothing.
 */

/** Matches the create form, which requires a non-empty subject. */
const MIN_LENGTH = 1
/**
 * The database column is unbounded `text`, but a subject also has to fit an
 * email subject line and the ticket list, so it is capped here.
 */
export const SUBJECT_MAX_LENGTH = 200

interface EditableSubjectProps {
  value: string
  canEdit: boolean
  onSave: (next: string) => void
  /** True while the save is in flight, so the control can lock. */
  isSaving?: boolean
}

export function EditableSubject({
  value,
  canEdit,
  onSave,
  isSaving = false,
}: EditableSubjectProps) {
  const [isEditing, setIsEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(value)
  const [error, setError] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Someone else may rename the ticket while this is open (realtime), and the
  // ticket itself changes when navigating between tabs. Re-sync when not
  // mid-edit so the field never shows a stale subject.
  React.useEffect(() => {
    if (!isEditing) setDraft(value)
  }, [value, isEditing])

  const startEditing = () => {
    if (!canEdit) return
    setDraft(value)
    setError(null)
    setIsEditing(true)
  }

  const cancel = () => {
    setDraft(value)
    setError(null)
    setIsEditing(false)
  }

  const commit = () => {
    const next = draft.trim()

    if (next.length < MIN_LENGTH) {
      // Stay in edit mode and say why, rather than silently reverting.
      setError("A subject is required.")
      inputRef.current?.focus()
      return
    }
    if (next.length > SUBJECT_MAX_LENGTH) {
      setError(`Keep it under ${SUBJECT_MAX_LENGTH} characters.`)
      inputRef.current?.focus()
      return
    }
    if (next === value) {
      // Nothing changed — don't write, don't log an event.
      cancel()
      return
    }

    onSave(next)
    setError(null)
    setIsEditing(false)
  }

  if (!isEditing) {
    return (
      <div className="mt-0.5 flex items-start gap-1.5">
        <h2 className="text-base text-gray-600 break-words">{value}</h2>
        {canEdit && (
          <button
            type="button"
            onClick={startEditing}
            title="Edit subject"
            aria-label="Edit subject"
            data-print="hide"
            className="mt-0.5 shrink-0 rounded p-0.5 text-gray-400 opacity-70 transition hover:bg-gray-100 hover:text-gray-700 hover:opacity-100 focus:opacity-100"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="mt-0.5" data-print="hide">
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          autoFocus
          type="text"
          value={draft}
          disabled={isSaving}
          aria-label="Ticket subject"
          aria-invalid={!!error}
          maxLength={SUBJECT_MAX_LENGTH}
          onChange={(e) => {
            setDraft(e.target.value)
            if (error) setError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              commit()
            } else if (e.key === "Escape") {
              e.preventDefault()
              cancel()
            }
          }}
          className="w-full max-w-2xl rounded-md border border-gray-300 px-2 py-1 text-base text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={commit}
          disabled={isSaving}
          title="Save subject"
          aria-label="Save subject"
          className="shrink-0 rounded p-1 text-green-600 hover:bg-green-50 disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={isSaving}
          title="Cancel"
          aria-label="Cancel editing subject"
          className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : (
        <p className="mt-1 text-xs text-gray-400">
          Enter to save · Esc to cancel
        </p>
      )}
    </div>
  )
}
