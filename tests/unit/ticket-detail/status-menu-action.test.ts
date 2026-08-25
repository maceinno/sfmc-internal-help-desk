import { describe, it, expect } from 'vitest'
import { resolveStatusMenuAction } from '@/components/ticket-detail/reply-composer'

// The composer's split button used to need TWO clicks to close a ticket:
// one on "Solved" in the dropdown (which only armed the button) and one on
// the button itself. Picking now acts. These cases pin that down.

const base = {
  currentStatus: 'open' as const,
  hasContent: false,
  canApplyStatusOnly: true,
}

describe('status dropdown — picking acts immediately', () => {
  it('applies the status on its own when nothing is typed', () => {
    expect(
      resolveStatusMenuAction({ ...base, status: 'solved' }),
    ).toBe('apply-status-only')
  })

  it('sends the typed reply carrying the status, in one pick', () => {
    expect(
      resolveStatusMenuAction({ ...base, status: 'solved', hasContent: true }),
    ).toBe('send-with-status')
  })

  it('sends a typed reply for every status, not just Solved', () => {
    for (const status of ['open', 'pending', 'on_hold', 'solved'] as const) {
      expect(
        resolveStatusMenuAction({ ...base, status, hasContent: true }),
      ).toBe('send-with-status')
    }
  })
})

describe('status dropdown — picks that must NOT act', () => {
  it('does not act when the ticket already holds that status', () => {
    expect(
      resolveStatusMenuAction({
        ...base,
        status: 'solved',
        currentStatus: 'solved',
      }),
    ).toBe('select-only')
  })

  it('only arms the button for "Send (no status change)"', () => {
    expect(resolveStatusMenuAction({ ...base, status: null })).toBe(
      'select-only',
    )
  })

  it('still sends a typed reply when the status matches the current one', () => {
    // The reply itself is real work — it must go out even though the
    // status half of the pick is a no-op.
    expect(
      resolveStatusMenuAction({
        ...base,
        status: 'solved',
        currentStatus: 'solved',
        hasContent: true,
      }),
    ).toBe('send-with-status')
  })

  it('does not apply a status when no handler was provided', () => {
    expect(
      resolveStatusMenuAction({
        ...base,
        status: 'solved',
        canApplyStatusOnly: false,
      }),
    ).toBe('select-only')
  })
})
