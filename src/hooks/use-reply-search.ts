'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  MIN_REPLY_SEARCH_TERM_LENGTH,
  type ReplyMatch,
} from '@/lib/tickets/search'

const DEBOUNCE_MS = 300

/** Delay a fast-changing value so typing doesn't fire a request per keystroke. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

/**
 * Tickets whose REPLY THREAD mentions the search term.
 *
 * Everything else about a ticket is searched in the browser against the
 * already-loaded list; reply bodies are not in that payload (~17.7k messages),
 * so they are searched on the server. Results are merged by the caller, which
 * is why this returns bare ticket ids plus a snippet.
 */
export function useReplySearch(searchTerm: string) {
  const term = useDebouncedValue(searchTerm.trim(), DEBOUNCE_MS)
  const enabled = term.length >= MIN_REPLY_SEARCH_TERM_LENGTH

  const query = useQuery<ReplyMatch[]>({
    queryKey: ['tickets', 'search-replies', term],
    enabled,
    // Search results age slowly enough that re-running on every remount is
    // wasted work; a minute is plenty for a term someone is still typing.
    staleTime: 60_000,
    queryFn: async () => {
      const res = await fetch(
        `/api/tickets/search-replies?q=${encodeURIComponent(term)}`,
      )
      if (!res.ok) throw new Error('Reply search failed')
      const body = (await res.json()) as { matches: ReplyMatch[] }
      return body.matches ?? []
    },
  })

  return {
    matches: enabled ? query.data ?? [] : [],
    isLoading: enabled && query.isLoading,
    /** The term the current matches actually correspond to. */
    matchedTerm: term,
  }
}
