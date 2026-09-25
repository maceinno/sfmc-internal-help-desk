// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// The probe row the fake Supabase client returns. Tests reassign this.
let probeRow: { id: string; updated_at: string } | null = null
// Rows the "only what changed" fetch returns, and the `since` it was asked for.
let changedRows: Record<string, unknown>[] = []
let changedSince: string | null = null

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: async () => 'fake-token' }),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClerkSupabaseClient: () => ({
    from: () => ({
      select: (cols: string) =>
        cols === 'id, updated_at'
          ? {
              // The freshness probe.
              order: () => ({
                limit: async () => ({ data: probeRow ? [probeRow] : [], error: null }),
              }),
            }
          : {
              // syncTicketListChanges: full list projection, changed rows only.
              gte: (_col: string, since: string) => {
                changedSince = since
                return {
                  order: () => ({
                    limit: async () => ({ data: changedRows, error: null }),
                  }),
                }
              },
            },
    }),
  }),
}))

import { useTicketFreshness } from '@/hooks/use-ticket-freshness'
import { ticketKeys } from '@/hooks/use-tickets'

function makeHarness() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return { queryClient, invalidate, wrapper }
}

const invalidatedKeys = (invalidate: ReturnType<typeof vi.spyOn>) =>
  invalidate.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: unknown })?.queryKey))

describe('useTicketFreshness', () => {
  beforeEach(() => {
    probeRow = { id: 'T-1', updated_at: '2026-09-22T10:00:00Z' }
    changedRows = []
    changedSince = null
  })

  it('does not refresh the ticket lists on the first reading', async () => {
    const { invalidate, wrapper } = makeHarness()
    renderHook(() => useTicketFreshness(), { wrapper })

    await waitFor(() => expect(invalidate).not.toHaveBeenCalled())
    expect(invalidatedKeys(invalidate)).toEqual([])
  })

  it('refreshes the lists and the open ticket once the newest change moves', async () => {
    const { queryClient, invalidate, wrapper } = makeHarness()
    const { rerender } = renderHook(() => useTicketFreshness(), { wrapper })

    // Let the baseline reading settle.
    await waitFor(() =>
      expect(queryClient.getQueryData(['tickets', 'freshness'])).toBe(
        'T-1:2026-09-22T10:00:00Z',
      ),
    )
    expect(invalidate).not.toHaveBeenCalled()

    // Something changed server-side; force the probe to run again.
    probeRow = { id: 'T-2', updated_at: '2026-09-22T10:05:00Z' }
    await queryClient.refetchQueries({ queryKey: ['tickets', 'freshness'] })
    rerender()

    await waitFor(() => expect(invalidate).toHaveBeenCalled())

    const keys = invalidatedKeys(invalidate)
    expect(keys).toContain(JSON.stringify(ticketKeys.lists()))
    expect(keys).toContain(JSON.stringify(ticketKeys.details()))
  })

  it('with a list already loaded, fetches only the changed tickets and merges them in', async () => {
    const { queryClient, invalidate, wrapper } = makeHarness()
    const listKey = ticketKeys.list({})
    queryClient.setQueryData(listKey, [
      { id: 'T-2', created_at: '2026-09-22T09:00:00Z', updated_at: '2026-09-22T09:30:00Z', status: 'open', messages: [], cc: [] },
      { id: 'T-1', created_at: '2026-09-22T08:00:00Z', updated_at: '2026-09-22T10:00:00Z', status: 'open', messages: [], cc: [] },
    ])

    const { rerender } = renderHook(() => useTicketFreshness(), { wrapper })
    await waitFor(() =>
      expect(queryClient.getQueryData(['tickets', 'freshness'])).toBe(
        'T-1:2026-09-22T10:00:00Z',
      ),
    )

    // Someone else solves T-2.
    changedRows = [
      { id: 'T-2', created_at: '2026-09-22T09:00:00Z', updated_at: '2026-09-22T10:05:00Z', status: 'solved', ticket_cc: [], ticket_collaborators: [], custom_field_values: [], messages: [] },
    ]
    probeRow = { id: 'T-2', updated_at: '2026-09-22T10:05:00Z' }
    await queryClient.refetchQueries({ queryKey: ['tickets', 'freshness'] })
    rerender()

    await waitFor(() => {
      const list = queryClient.getQueryData<{ id: string; status: string }[]>(listKey)!
      expect(list.find((x) => x.id === 'T-2')!.status).toBe('solved')
    })

    // Asked for changes since the newest ticket it already had...
    expect(changedSince).toBe('2026-09-22T10:00:00Z')
    // ...and never threw the shared list away to re-download all of it.
    const reloadedWholeList = invalidate.mock.calls.some((c) => {
      const arg = c[0] as { queryKey?: unknown; predicate?: unknown }
      return !arg.predicate && JSON.stringify(arg.queryKey) === JSON.stringify(listKey)
    })
    expect(reloadedWholeList).toBe(false)
  })

  it('leaves the lists alone when the probe comes back unchanged', async () => {
    const { queryClient, invalidate, wrapper } = makeHarness()
    renderHook(() => useTicketFreshness(), { wrapper })

    await waitFor(() =>
      expect(queryClient.getQueryData(['tickets', 'freshness'])).toBe(
        'T-1:2026-09-22T10:00:00Z',
      ),
    )

    await queryClient.refetchQueries({ queryKey: ['tickets', 'freshness'] })
    await queryClient.refetchQueries({ queryKey: ['tickets', 'freshness'] })

    expect(invalidate).not.toHaveBeenCalled()
  })

  it('watches the ticket lists without sharing their cache key', () => {
    // If the probe lived under ['tickets','list'] every list invalidation
    // would also re-run the probe, and the probe would refresh the lists.
    const listKey = JSON.stringify(ticketKeys.lists())
    expect(JSON.stringify(['tickets', 'freshness']).startsWith(listKey.slice(0, -1))).toBe(false)
  })
})
