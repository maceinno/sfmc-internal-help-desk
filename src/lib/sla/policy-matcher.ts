import type { Ticket, SlaPolicy, SlaPolicyConditions } from '@/types/ticket';

/**
 * Predicate: does this set of SLA conditions match the given ticket?
 *
 * A condition list of `'any'` always matches. A non-`'any'` list requires
 * the ticket's corresponding field to be present and included in the list.
 * Subcategory is opt-in (only honored when set + non-`'any'`).
 *
 * Used by both `findMatchingPolicy` (live SLA resolution) and the admin
 * form's match-preview (showing how many tickets a rule covers).
 */
export function conditionsMatchTicket(
  conditions: SlaPolicyConditions,
  ticket: Ticket,
): boolean {
  if (conditions.ticketTypes !== 'any') {
    if (
      !ticket.ticket_type ||
      !(conditions.ticketTypes as string[]).includes(ticket.ticket_type)
    ) {
      return false;
    }
  }

  if (conditions.categories !== 'any') {
    if (!(conditions.categories as string[]).includes(ticket.category)) {
      return false;
    }
  }

  if (conditions.priorities !== 'any') {
    if (!conditions.priorities.includes(ticket.priority)) {
      return false;
    }
  }

  if (conditions.subCategories && conditions.subCategories !== 'any') {
    if (
      !ticket.sub_category ||
      !conditions.subCategories.includes(ticket.sub_category)
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Find the first SLA policy whose conditions match the given ticket.
 *
 * Policies are evaluated in ascending `sort_order`. A policy matches when
 * its conditions pass `conditionsMatchTicket`.
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
    if (conditionsMatchTicket(policy.conditions, ticket)) {
      return policy;
    }
  }

  return null;
}
