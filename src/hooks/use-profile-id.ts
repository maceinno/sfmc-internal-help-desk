'use client'

import { useUser } from '@clerk/nextjs'

/**
 * Returns the id used to look up rows in `profiles` (and any FK that
 * references it — `to_user_id`, `assigned_to`, etc.).
 *
 * For users migrated from the dev Clerk instance, `user.externalId`
 * holds the original dev clerk user_id which is what `profiles.id`
 * was seeded with. For users created natively in prod, externalId is
 * null and we fall back to `user.id`.
 *
 * Server-side equivalent: `getProfileId()` in src/lib/clerk/resolve-id.ts.
 */
export function useProfileId(): string | null {
  const { user } = useUser()
  if (!user) return null
  return user.externalId ?? user.id
}
