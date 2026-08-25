import { describe, it, expect } from 'vitest'
import { resolveReplyRecipients } from '@/lib/email/reply-recipients'

// Agents were being emailed their own replies: the recipient list added
// the author outright, and even without that the author is usually the
// assignee too. These cases pin the audience down from both directions.

const AGENT = 'user-agent'
const REQUESTER = 'user-requester'
const OTHER_AGENT = 'user-other-agent'
const CC = 'user-cc'

const base = {
  createdBy: REQUESTER,
  assignedTo: AGENT,
  isInternal: false,
  ccUserIds: [] as string[],
  collaboratorIds: [] as string[],
}

describe('reply email — the author never gets their own reply', () => {
  it('leaves the agent out when the agent replies', () => {
    const to = resolveReplyRecipients({ ...base, authorId: AGENT })
    expect(to).toEqual([REQUESTER])
  })

  it('leaves the agent out even when they own the ticket and are on the CC list', () => {
    const to = resolveReplyRecipients({
      ...base,
      authorId: AGENT,
      ccUserIds: [AGENT, CC],
    })
    expect(to).not.toContain(AGENT)
    expect(to).toEqual(expect.arrayContaining([REQUESTER, CC]))
  })

  it('leaves the requester out when the requester replies', () => {
    const to = resolveReplyRecipients({ ...base, authorId: REQUESTER })
    expect(to).toEqual([AGENT])
  })

  it('leaves the author out of an internal note they wrote', () => {
    const to = resolveReplyRecipients({
      ...base,
      authorId: AGENT,
      isInternal: true,
      collaboratorIds: [AGENT, OTHER_AGENT],
    })
    expect(to).toEqual([OTHER_AGENT])
  })

  it('sends to nobody when the author is the only party', () => {
    const to = resolveReplyRecipients({
      ...base,
      authorId: AGENT,
      createdBy: AGENT,
    })
    expect(to).toEqual([])
  })
})

describe('reply email — everyone else still hears about it', () => {
  it('reaches the requester, the owner and every CC on a public reply', () => {
    const to = resolveReplyRecipients({
      ...base,
      authorId: OTHER_AGENT,
      ccUserIds: [CC],
    })
    expect(to).toEqual(expect.arrayContaining([REQUESTER, AGENT, CC]))
    expect(to).toHaveLength(3)
  })

  it('never sends an internal note to the requester', () => {
    const to = resolveReplyRecipients({
      ...base,
      authorId: OTHER_AGENT,
      isInternal: true,
      ccUserIds: [CC],
      collaboratorIds: [AGENT],
    })
    expect(to).not.toContain(REQUESTER)
    expect(to).not.toContain(CC)
    expect(to).toEqual([AGENT])
  })

  it('still reaches the requester when nobody owns the ticket yet', () => {
    const to = resolveReplyRecipients({
      ...base,
      authorId: OTHER_AGENT,
      assignedTo: null,
    })
    expect(to).toEqual([REQUESTER])
  })

  it('does not duplicate someone who is both the owner and a CC', () => {
    const to = resolveReplyRecipients({
      ...base,
      authorId: OTHER_AGENT,
      ccUserIds: [AGENT],
    })
    expect(to).toHaveLength(2)
  })
})
