import { describe, it, expect } from 'vitest';
import { hydrateMessage, hydrateMessages } from '@/lib/messages/hydrate';

describe('hydrateMessage', () => {
  it('lifts author.role to author_role and strips author', () => {
    const raw = {
      id: 'm-1',
      author_id: 'user-1',
      content: 'hi',
      created_at: '2025-06-01T10:00:00Z',
      is_internal: false,
      author: { role: 'agent' },
    };

    const m = hydrateMessage(raw);
    expect(m.author_role).toBe('agent');
    expect((m as Record<string, unknown>).author).toBeUndefined();
    expect(m.id).toBe('m-1');
  });

  it('omits author_role when the join produced no author row', () => {
    const raw = {
      id: 'm-2',
      author_id: 'user-1',
      content: 'hi',
      created_at: '2025-06-01T10:00:00Z',
      is_internal: false,
      author: null,
    };

    const m = hydrateMessage(raw);
    expect(m.author_role).toBeUndefined();
  });

  it('passes through messages that have no author key at all', () => {
    const raw = {
      id: 'm-3',
      author_id: 'user-1',
      content: 'hi',
      created_at: '2025-06-01T10:00:00Z',
      is_internal: false,
    };

    const m = hydrateMessage(raw);
    expect(m.author_role).toBeUndefined();
    expect(m.id).toBe('m-3');
  });
});

describe('hydrateMessages', () => {
  it('handles null/undefined input', () => {
    expect(hydrateMessages(null)).toEqual([]);
    expect(hydrateMessages(undefined)).toEqual([]);
  });

  it('hydrates an array of messages', () => {
    const rows = [
      {
        id: 'm-1',
        author_id: 'a',
        content: '',
        created_at: 't',
        is_internal: false,
        author: { role: 'agent' },
      },
      {
        id: 'm-2',
        author_id: 'b',
        content: '',
        created_at: 't',
        is_internal: false,
        author: { role: 'employee' },
      },
    ];

    const out = hydrateMessages(rows);
    expect(out).toHaveLength(2);
    expect(out[0].author_role).toBe('agent');
    expect(out[1].author_role).toBe('employee');
  });
});
