import type { RoutingRule, User } from '@/types/ticket'

// ============================================================================
// Routing Rule Engine
// Evaluates enabled routing rules against a ticket's type and category to
// determine automatic assignment (user and/or team).
// ============================================================================

export interface RoutingResult {
  assignedTo?: string
  assignedTeam?: string
}

/**
 * Apply routing rules to determine who a ticket should be assigned to.
 *
 * Rules are evaluated in priority order (lowest number first). The first
 * matching rule wins. If a rule targets a team, a random available agent
 * (not OOO) from that team is selected.
 *
 * @param ticketType - The ticket's type (e.g. "IT Support").
 * @param category   - The ticket's category (e.g. "Closing").
 * @param routingRules - All routing rules (will be filtered to enabled only).
 * @param users      - All users in the system (used for team member lookup).
 * @returns The routing result with optional assignedTo and assignedTeam.
 */
export function applyRoutingRules(
  ticketType: string | undefined,
  category: string,
  routingRules: RoutingRule[],
  users: User[],
): RoutingResult {
  // Filter to enabled rules and sort by priority ascending (lower = higher priority)
  const activeRules = routingRules
    .filter((r) => r.enabled)
    .sort((a, b) => a.priority_order - b.priority_order)

  for (const rule of activeRules) {
    const typeMatch =
      rule.ticket_type === 'any' || rule.ticket_type === ticketType
    const categoryMatch =
      rule.category === 'any' || rule.category === category

    if (typeMatch && categoryMatch) {
      if (rule.assign_to_user) {
        return { assignedTo: rule.assign_to_user }
      }

      if (rule.assign_to_team) {
        // Find agents in this team who are not out of office
        const teamMembers = users.filter(
          (u) =>
            (u.team_ids ?? []).includes(rule.assign_to_team!) &&
            u.role !== 'employee' &&
            !u.is_out_of_office,
        )

        if (teamMembers.length > 0) {
          const randomAgent =
            teamMembers[Math.floor(Math.random() * teamMembers.length)]
          return {
            assignedTo: randomAgent.id,
            assignedTeam: rule.assign_to_team,
          }
        }

        // No available agents, but still set the team
        return { assignedTeam: rule.assign_to_team }
      }
    }
  }

  // No matching rule
  return {}
}
