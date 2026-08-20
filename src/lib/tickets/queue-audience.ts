/**
 * Who is on the hook for a ticket sitting in a team's queue.
 *
 * Shared by the SLA alerts and the department-move notification, both of
 * which need "the people who would have got the new-ticket email for this
 * queue" — active, non-out-of-office agents and admins with an address.
 */

/** The shape of a profile row a queue fan-out needs. */
export interface QueueMember {
  id: string
  email: string | null
  role: string
  is_out_of_office?: boolean | null
  is_active?: boolean | null
}

export function eligibleQueueRecipients(
  members: QueueMember[] | null | undefined,
  opts: { exclude?: (string | null | undefined)[] } = {},
): string[] {
  const excluded = new Set((opts.exclude ?? []).filter(Boolean) as string[])
  return (members ?? [])
    .filter(
      (m) =>
        (m.role === 'agent' || m.role === 'admin') &&
        !m.is_out_of_office &&
        m.is_active !== false &&
        Boolean(m.email) &&
        !excluded.has(m.id),
    )
    .map((m) => m.id)
}

/**
 * The team whose queue serves a given department.
 *
 * There is no column joining the two: departments live on the ticket
 * (`ticket_type`) and queues live in `teams`, and they are matched by NAME —
 * every one of the nine departments has a team of exactly the same name.
 * Matching is trimmed and case-insensitive so a stray space or capital in
 * either list doesn't silently break the handover.
 *
 * Returns null when no team matches, and the caller must then leave the
 * ticket where it is rather than stranding it in a queue nobody watches.
 */
export function teamForDepartment(
  department: string | null | undefined,
  teams: { id: string; name: string | null }[] | null | undefined,
): { id: string; name: string } | null {
  if (!department) return null
  const wanted = department.trim().toLowerCase()
  for (const team of teams ?? []) {
    if ((team.name ?? '').trim().toLowerCase() === wanted) {
      return { id: team.id, name: team.name ?? department }
    }
  }
  return null
}
