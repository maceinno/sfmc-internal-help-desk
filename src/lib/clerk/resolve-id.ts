import type { ClerkClient } from '@clerk/backend'
import { auth } from '@clerk/nextjs/server'

/**
 * Effective profile id for the current request.
 *
 * Background: after migrating to a new Clerk instance (dev → prod) we
 * store every legacy Clerk user id as `external_id` on the new user, so
 * existing FK rows in Supabase stay valid without a database rewrite.
 *
 * Clerk's session-token customizer treats `sub` as reserved, so we can't
 * override it directly there. Instead we surface the resolved id as a
 * custom claim called `userId` set in the session-token template:
 *
 *   { "userId": "{{user.external_id || user.id}}", ... }
 *
 * This helper reads that claim and falls back to `auth().userId` (the
 * actual Clerk id) when the claim is absent — i.e. for genuinely new
 * users created post-migration who have no `external_id`. The two values
 * are the same in that case, so the fallback is safe.
 *
 * Use the returned id anywhere we'd previously have used `auth().userId`
 * for a Supabase profile lookup or FK insert. For Clerk Backend API
 * calls, keep using the raw `auth().userId` — Clerk needs its own id.
 */
export async function getProfileId(): Promise<string | null> {
  const { userId, sessionClaims } = await auth()
  if (!userId) return null
  const claim = sessionClaims?.userId
  if (typeof claim === 'string' && claim.length > 0) return claim
  return userId
}

/**
 * Resolve a profile id (which may be either a Clerk user id or a legacy
 * external_id from a previous Clerk instance) to the current Clerk user id.
 *
 * Used for any Clerk Backend API call (`updateUser`, `updateUserMetadata`,
 * `deleteUser`, etc.) that takes a Clerk id but is given a value sourced
 * from our profile table — which may be the legacy external_id.
 *
 * For users that were never migrated, the legacy id and current id are
 * the same, so `getUser` succeeds on the first try.
 */
export async function resolveClerkId(
  client: ClerkClient,
  idOrExternalId: string,
): Promise<string> {
  try {
    const user = await client.users.getUser(idOrExternalId)
    return user.id
  } catch {
    const list = await client.users.getUserList({
      externalId: [idOrExternalId],
    })
    const hit = list.data[0]
    if (!hit) {
      throw new Error(
        `Could not resolve a Clerk user for id/external_id "${idOrExternalId}"`,
      )
    }
    return hit.id
  }
}
