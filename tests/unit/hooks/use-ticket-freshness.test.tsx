// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// The probe row the fake Supabase client returns. Tests reassign this.
let probeRow: { id: string; updated_at: string } | null = null

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: async () => 'fake-token' }),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClerkSupabaseClient: () => ({
    from: () => ({
      select: () => ({
        order: () => ({
          limit: async () => ({ data: probeRow ? [probeRow] : [], error: null }),
        }),
      }),
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
