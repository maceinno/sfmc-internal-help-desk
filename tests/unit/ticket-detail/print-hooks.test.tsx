// @vitest-environment jsdom
// (vitest.config.mts still lists `environmentMatchGlobs`, which Vitest 4 no
// longer honours — the docblock above is what actually selects jsdom.)
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MessageThread } from '@/components/ticket-detail/message-thread'
import type { Message, User } from '@/types'

// The thread reads the viewer's timezone through TanStack Query / Clerk,
// neither of which is needed to assert layout classes.
vi.mock('@/hooks/use-timezone', () => ({
  useTimezone: () => ({
    timezone: 'America/Chicago',
    formatDateTime: () => 'Aug 19, 2026 9:00 AM',
    formatDate: () => 'Aug 19, 2026',
    formatTime: () => '9:00 AM',
    formatRelative: () => 'today',
  }),
}))

const users = [
  { id: 'u1', name: 'Dana Reyes', email: 'dana@example.com', role: 'employee' },
  { id: 'u2', name: 'Sam Patel', email: 'sam@example.com', role: 'agent' },
] as unknown as User[]

const messages: Message[] = [
  {
    id: 'm1',
    author_id: 'u2',
    content: '<p>Try the guest network.</p>',
    created_at: '2026-08-19T09:00:00Z',
    is_internal: false,
  },
  {
    id: 'm2',
    author_id: 'u2',
    content: 'Escalating to networking.',
    created_at: '2026-08-19T10:00:00Z',
    is_internal: true,
  },
  {
    id: 'm3',
    author_id: 'u2',
    content: 'changed status to open',
    created_at: '2026-08-19T10:05:00Z',
    is_internal: false,
    is_system: true,
  },
]

function renderThread() {
  return render(
    <MessageThread
      messages={messages}
      users={users}
      currentUserId="u2"
      ticketDescription="<p>VPN drops on the Denver wifi.</p>"
      ticketCreatedBy="u1"
      ticketCreatedAt="2026-08-19T08:00:00Z"
      attachments={[]}
    />,
  )
}

describe('conversation thread — print layout hooks', () => {
  it('marks the thread containers so they leave flex layout when printing', () => {
    const { container } = renderThread()
    // Outer thread wrapper + the messages container: both are flex/scroll
    // boxes on screen and must drop to block flow on paper, or the print
    // stops at the first page break.
    expect(container.querySelectorAll('.print-stack').length).toBe(2)
  })

  it('marks every message so it is not split across a page break', () => {
    const { container } = renderThread()
    // 3 messages (one reply, one internal note, one system event) plus the
    // original request block.
    expect(container.querySelectorAll('.print-keep-together').length).toBe(4)
  })

  it('still renders the message content itself', () => {
    const { container } = renderThread()
    expect(container.textContent).toContain('Try the guest network.')
    expect(container.textContent).toContain('Escalating to networking.')
    expect(container.textContent).toContain('VPN drops on the Denver wifi.')
  })

  it('keeps the scroll classes for on-screen use', () => {
    const { container } = renderThread()
    // The print rules override these; they must still be present so the
    // on-screen pane scrolls exactly as it did before.
    expect(container.querySelector('.overflow-y-auto')).not.toBeNull()
  })
})
