import type { ClerkClient } from '@clerk/backend'

/**
 * Resolve a profile id (which may be either a Clerk user id or a legacy
 * external_id from a previous Clerk instance) to the current Clerk user id.
 *
 * Background: when migrating from one Clerk instance to another (e.g.
 * dev → production), the migration tool stores the original user id as
 * `external_id` on the new Clerk user. Our session JWT template overrides
 * `sub` to `{{user.external_id || user.id}}`, so `auth().userId` and our
 * profiles table both stay on the legacy id. Clerk Backend API calls,
 * however, still need the ACTUAL current Clerk user id — this helper
 * bridges the gap.
 *
 * For users that were never migrated (genuinely new in this instance),
 * the legacy id and current id are the same — getUser succeeds on the
 * first try and we return that.
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
