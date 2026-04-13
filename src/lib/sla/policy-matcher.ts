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
    .sort((a, b) => a.order - b.order);

  for (const policy of enabledPolicies) {
    const { conditions } = policy;

    if (conditions.ticketTypes !== 'any') {
      if (
        !ticket.ticketType ||
        !conditions.ticketTypes.includes(ticket.ticketType)
      ) {
        continue;
      }
    }

    if (conditions.categories !== 'any') {
      if (!conditions.categories.includes(ticket.category)) {
        continue;
      }
    }

    if (conditions.priorities !== 'any') {
      if (!conditions.priorities.includes(ticket.priority)) {
        continue;
      }
    }

    if (conditions.subCategories && conditions.subCategories !== 'any') {
      if (
        !ticket.subCategory ||
        !conditions.subCategories.includes(ticket.subCategory)
      ) {
        continue;
      }
    }

    return policy;
  }

  return null;
}
