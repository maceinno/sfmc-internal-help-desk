// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { assertTicketAccess } from '@/lib/permissions/assert-ticket-access'

// A fake Supabase client just capable enough for assertTicketAccess: one
// profile lookup (.eq().single()), ticket_cc / ticket_collaborators lookups
// (.eq().eq().maybeSingle()), and the parties lookup (.in()).
type Row = Record<string, unknown>
function fakeSupabase(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      const rows = tables[table] ?? []
      const filters: [string, unknown][] = []
      const matching = () =>
        rows.filter((r) => filters.every(([k, v]) => r[k] === v))
      const q = {
        select: () => q,
        eq: (k: string, v: unknown) => {
          filters.push([k, v])
          return q
        },
        single: async () => ({ data: matching()[0] ?? null, error: null }),
        maybeSingle: async () => ({ data: matching()[0] ?? null, error: null }),
        in: async (k: string, vs: unknown[]) => ({
          data: rows.filter((r) => vs.includes(r[k])),
          error: null,
        }),
      }
      return q
    },
  } as unknown as Parameters<typeof assertTicketAccess>[0]
}

const BRANCH_A = '0c2002e5-0000-4000-8000-00000000000a'
const BRANCH_B = '15b2863d-0000-4000-8000-00000000000b'
const BRANCH_C = '2a89f788-0000-4000-8000-00000000000c'

// A ticket raised by someone in branch B.
const ticket = { created_by: 'emp-b', assigned_to: null }
const parties = [
  { id: 'emp-b', branch_id: BRANCH_B, region_id: null },
]

function managerWith(fields: Row) {
  return fakeSupabase({
    profiles: [
      {
        id: 'mgr',
        role: 'employee',
        has_regional_access: false,
        managed_region_id: null,
        has_branch_access: true,
        managed_branch_id: null,
        managed_branch_ids: null,
        ...fields,
      },
      ...parties,
    ],
  })
}

describe("assertTicketAccess 'respond' — branch managers", () => {
  it('allows a manager whose SECOND listed branch is the ticket\'s branch', async () => {
    // Legacy single branch is A; the list (what the admin screen writes)
    // also includes B. Before 2026-09-25 only A was consulted → refused.
    const supabase = managerWith({
      managed_branch_id: BRANCH_A,
      managed_branch_ids: [BRANCH_A, BRANCH_B],
    })
    const res = await assertTicketAccess(supabase, 'mgr', 'T-1', ticket, 'respond')
    expect(res.ok).toBe(true)
  })

  it('still refuses when none of their branches match', async () => {
    const supabase = managerWith({
      managed_branch_id: BRANCH_A,
      managed_branch_ids: [BRANCH_A, BRANCH_C],
    })
    const res = await assertTicketAccess(supabase, 'mgr', 'T-1', ticket, 'respond')
    expect(res.ok).toBe(false)
  })

  it('falls back to the legacy single branch when the list is empty', async () => {
    const supabase = managerWith({
      managed_branch_id: BRANCH_B,
      managed_branch_ids: [],
    })
    const res = await assertTicketAccess(supabase, 'mgr', 'T-1', ticket, 'respond')
    expect(res.ok).toBe(true)
  })

  it('ignores the branch list entirely when branch access is switched off', async () => {
    const supabase = managerWith({
      has_branch_access: false,
      managed_branch_id: BRANCH_B,
      managed_branch_ids: [BRANCH_B],
    })
    const res = await assertTicketAccess(supabase, 'mgr', 'T-1', ticket, 'respond')
    expect(res.ok).toBe(false)
  })
})
