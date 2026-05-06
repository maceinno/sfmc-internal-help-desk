import type { Ticket, SlaPolicy } from '@/types/ticket';

/**
 * Find the first SLA policy whose conditions match the given ticket.
 *
 * Policies are evaluated in ascending `order`. A policy matches when every
 * non-"any" condition list includes the ticket's corresponding field value.
 *
 * @returns The matching policy, or `null` if none match.
 */
export function findMatchingPolicy(
  ticket: Ticket,
  policies: SlaPolicy[],
): SlaPolicy | null {
  const enabledPolicies = policies
    .filter((p) => p.enabled)
    .sort((a, b) => a.sort_order - b.sort_order);

  for (const policy of enabledPolicies) {
    const { conditions } = policy;

    if (conditions.ticketTypes !== 'any') {
      if (
        !ticket.ticket_type ||
        !(conditions.ticketTypes as string[]).includes(ticket.ticket_type)
      ) {
        continue;
      }
    }

    if (conditions.categories !== 'any') {
      if (!(conditions.categories as string[]).includes(ticket.category)) {
        continue;
      }
    }

    if (conditions.priorities !== 'any') {
      if (!conditions.priorities.includes(ticket.priority)) {
        continue;
      }
    }

    // Note: `subCategories` is intentionally NOT honored here. The admin
    // SLA form has no UI to view or edit it, so a stray value (whether
    // from a seed bug or a direct DB edit) silently skips matching policies
    // with no way for admins to debug it. We hit exactly that bug 2026-05-06
    // — every Lending Support SLA had subCategories planted by the seed
    // and silently failed to fire. Reintroduce filtering here only after
    // the admin form exposes the field.

    return policy;
  }

  return null;
}
