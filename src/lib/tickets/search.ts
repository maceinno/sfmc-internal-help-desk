import type { Ticket, User } from '@/types'

/**
 * Ticket search matching.
 *
 * The search box used to look at the ticket title and id only, which meant
 * the thing agents actually search by — a loan/lead number — was unfindable,
 * because it is never in the subject. It lives in the "Lead/Loan Number"
 * custom field (2,590 of 3,616 tickets carry one), and often gets appended
 * to "Borrower Name" as well.
 *
 * Those values are user-typed and messy in the real data:
 *
 *   "33021880509"        clean
 *   "\t45001880634"      leading tab (pasted from a spreadsheet)
 *   "62001880407 "       trailing space
 *   "John Rhew-45001880556"   number appended to a borrower name
 *   "na"                 placeholder text
 *
 * So matching normalises BOTH sides: whitespace collapsed, punctuation that
 * people scatter through reference numbers (spaces, dashes, hyphens) removed
 * for the numeric comparison. Searching "45001880634" has to find the row
 * stored as "\t45001880634", and searching "45001880556" has to find it
 * inside "John Rhew-45001880556".
 */

/**
 * Shortest term the reply search will act on. Below this the result set is
 * meaningless and the scan is wasted. Shared so the client hook and the
 * server route cannot disagree about it.
 */
export const MIN_REPLY_SEARCH_TERM_LENGTH = 3

/**
 * Escape the wildcards that pass through to SQL LIKE. Without this a term
 * containing `%` matches every reply, and `_` matches any single character —
 * so a user typing a literal percent sign gets the whole table back.
 */
export function escapeLikeTerm(term: string): string {
  return term.replace(/[\\%_]/g, (ch) => `\\${ch}`)
}

/** A ticket whose reply thread mentions the search term. */
export interface ReplyMatch {
  ticketId: string
  /** Plain-text excerpt of the matching reply. */
  snippet: string
  authorId: string
  createdAt: string
  isInternal: boolean
}

/** Custom field ids that hold reference numbers worth searching. */
const LOAN_NUMBER_FIELD_IDS = ['custom-loan-number']
const NAME_FIELD_IDS = ['custom-borrower-name']

/** Lower-case, collapse runs of whitespace (incl. tabs), trim. */
export function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Reduce a reference number to comparable digits/letters — drops spaces,
 * tabs, dashes and dots so "45001880634", "45001880634 " and
 * "Rhew-45001880556" all compare on the same basis.
 */
export function normalizeReference(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Strip HTML tags so a search term matches rich-text descriptions. */
function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, ' ')
}

function customFieldText(ticket: Ticket, fieldIds: string[]): string[] {
  const values = ticket.custom_fields ?? []
  const out: string[] = []
  for (const v of values) {
    if (!fieldIds.includes(v.field_id)) continue
    if (v.value === null || v.value === undefined) continue
    if (Array.isArray(v.value)) out.push(...v.value.map(String))
    else out.push(String(v.value))
  }
  return out
}

export interface TicketSearchContext {
  /** Used to resolve requester/assignee ids to names and emails. */
  usersById: Map<string, User>
}

export function buildUserIndex(users: User[]): Map<string, User> {
  const map = new Map<string, User>()
  for (const u of users) map.set(u.id, u)
  return map
}

/**
 * Does this ticket match the search term?
 *
 * Matches on: ticket number, subject, description, Lead/Loan Number,
 * Borrower Name, and the name or email of the requester and the assignee.
 * All matching is substring-based and case-insensitive.
 */
export function ticketMatchesSearch(
  ticket: Ticket,
  rawTerm: string,
  ctx: TicketSearchContext,
): boolean {
  const term = normalizeText(rawTerm)
  if (!term) return true

  // Ticket number: tolerate "T-1042", "t-1042" and a bare "1042".
  const id = normalizeText(ticket.id)
  if (id.includes(term)) return true
  if (normalizeReference(ticket.id).includes(normalizeReference(term))) return true

  if (normalizeText(ticket.title).includes(term)) return true
  if (normalizeText(stripTags(ticket.description ?? '')).includes(term)) return true

  // Reference numbers — compared with punctuation and whitespace removed so
  // the messy stored values still match a cleanly typed search.
  const refTerm = normalizeReference(term)
  if (refTerm) {
    for (const value of customFieldText(ticket, LOAN_NUMBER_FIELD_IDS)) {
      if (normalizeReference(value).includes(refTerm)) return true
    }
  }

  // Borrower name — matched as text AND as a reference, because the real
  // data has loan numbers appended to borrower names.
  for (const value of customFieldText(ticket, NAME_FIELD_IDS)) {
    if (normalizeText(value).includes(term)) return true
    if (refTerm && normalizeReference(value).includes(refTerm)) return true
  }

  // People on the ticket — requester and assignee, by name or email.
  for (const userId of [ticket.created_by, ticket.assigned_to]) {
    if (!userId) continue
    const user = ctx.usersById.get(userId)
    if (!user) continue
    if (normalizeText(user.name).includes(term)) return true
    if (normalizeText(user.email).includes(term)) return true
  }

  return false
}
