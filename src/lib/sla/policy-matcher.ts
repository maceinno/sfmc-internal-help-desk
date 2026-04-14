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

    if (conditions.subCategories && conditions.subCategories !== 'any') {
      if (
        !ticket.sub_category ||
        !conditions.subCategories.includes(ticket.sub_category)
      ) {
        continue;
      }
    }

    return policy;
  }

  return null;
}
