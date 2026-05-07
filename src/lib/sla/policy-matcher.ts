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
 * Predicate: do these two SLA condition sets overlap?
 *
 * Two condition sets overlap when there exists at least one
 * (ticketType, category, priority [, subcategory]) tuple that satisfies
 * BOTH. Per-axis rule:
 *   - 'any' satisfies anything → overlap on this axis is automatic
 *   - both specific → must share at least one common value
 *   - subcategory: only relevant when at least one side has a non-'any'
 *     filter; if both are unset/any, treated as no constraint (overlap)
 *
 * Used by the SLA admin form to warn admins when a new/edited rule's
 * scope overlaps another rule's. With multiple matching rules, the one
 * with the lower `sort_order` wins.
 */
export function conditionsOverlap(
  a: SlaPolicyConditions,
  b: SlaPolicyConditions,
): boolean {
  const axisOverlap = <T extends string>(
    listA: T[] | 'any',
    listB: T[] | 'any',
  ): boolean => {
    if (listA === 'any' || listB === 'any') return true
    return listA.some((v) => listB.includes(v))
  }

  if (!axisOverlap(a.ticketTypes, b.ticketTypes)) return false
  if (!axisOverlap(a.categories, b.categories)) return false
  if (!axisOverlap(a.priorities, b.priorities)) return false

  // Subcategories: if either side is unset or 'any', no constraint.
  const aSubs = a.subCategories
  const bSubs = b.subCategories
  if (aSubs && aSubs !== 'any' && bSubs && bSubs !== 'any') {
    if (!aSubs.some((s) => bSubs.includes(s))) return false
  }

  return true
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
