import type { Message } from '@/types/ticket';

/**
 * Flatten a Supabase response row that joined `author:profiles(role)` onto
 * a message. Lifts `row.author.role` to `row.author_role` and strips the
 * `author` wrapper so consumers get a clean `Message` shape.
 *
 * Used by every query path that feeds `getSlaStatus` so the SLA
 * calculator can authoritatively distinguish agent replies from end-user
 * replies via role rather than the legacy `author_id !== created_by`
 * proxy.
 */
export function hydrateMessage(row: Record<string, unknown>): Message {
  const author = row.author as { role?: string } | null | undefined;
  const result: Record<string, unknown> = { ...row };
  if (author?.role) {
    result.author_role = author.role;
  }
  delete result.author;
  return result as unknown as Message;
}

export function hydrateMessages(
  rows: Array<Record<string, unknown>> | null | undefined,
): Message[] {
  return (rows ?? []).map(hydrateMessage);
}
