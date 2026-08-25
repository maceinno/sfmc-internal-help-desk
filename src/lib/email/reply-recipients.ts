/**
 * Who receives the email for a new reply.
 *
 * The author is ALWAYS excluded. They were just in the composer; an echo
 * of their own message is noise, and it is the rule the rest of the email
 * layer already follows — a status change skips whoever made it, an
 * assignment skips a self-assign. The exclusion is applied last on
 * purpose: the author is very often also the assignee (an agent replying
 * to a ticket they own), the creator, or a CC, and each of those adds
 * would otherwise put them straight back in.
 *
 * Lives outside notify.ts (which is `server-only`) so the audience can be
 * tested without a database or a mail client — the same split status-email.ts
 * uses.
 */
export function resolveReplyRecipients(p: {
  authorId: string
  createdBy: string
  assignedTo: string | null
  isInternal: boolean
  ccUserIds: string[]
  collaboratorIds: string[]
}): string[] {
  const ids = new Set<string>()

  if (!p.isInternal) {
    // A public reply reaches the requester, the owner and anyone CC'd.
    ids.add(p.createdBy)
    if (p.assignedTo) ids.add(p.assignedTo)
    p.ccUserIds.forEach((id) => ids.add(id))
  } else {
    // An internal note stays with the owner and collaborators — it must
    // never reach the requester.
    if (p.assignedTo) ids.add(p.assignedTo)
    p.collaboratorIds.forEach((id) => ids.add(id))
  }

  ids.delete(p.authorId)

  return [...ids]
}
