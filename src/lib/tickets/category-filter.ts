/**
 * The ticket list's category filter.
 *
 * It was built from `departmentGroups.map(g => g.ticket_type)` — so the
 * dropdown labelled "All Categories" actually listed DEPARTMENTS (Lending
 * Support, IT Support, …) while the filter compared them against each
 * ticket's CATEGORY (Password Reset, Post Closing, …). Those two sets do not
 * overlap by a single value in the live data, so every option except "All
 * Categories" returned an empty list.
 *
 * Categories are department-scoped — nine of the ten departments define an
 * "Other", and several share names like "General" — so the filter value
 * carries the department with it. Picking Marketing Support → Other must not
 * drag in IT Support's "Other" tickets.
 */

export const ALL_CATEGORIES = 'all'

/** 'all' | 'dept:<department>' | 'cat:<department>::<category>' */
export type CategoryFilterValue = string

// Departments and categories are admin-entered free text, but neither
// contains a colon pair — the separator stays unambiguous.
const SEPARATOR = '::'

/** Every ticket in one department, whatever its category. */
export function departmentFilterValue(department: string): CategoryFilterValue {
  return `dept:${department}`
}

/** One category within one department. */
export function categoryFilterValue(
  department: string,
  category: string,
): CategoryFilterValue {
  return `cat:${department}${SEPARATOR}${category}`
}

export type ParsedCategoryFilter =
  | { kind: 'all' }
  | { kind: 'department'; department: string }
  | { kind: 'category'; department: string; category: string }
  // Anything unrecognised is treated as a bare category name, which is what
  // the filter used to hold. Keeps an old bookmarked or restored value
  // filtering on something sensible instead of silently matching nothing.
  | { kind: 'legacyCategory'; category: string }

export function parseCategoryFilter(
  value: CategoryFilterValue | null | undefined,
): ParsedCategoryFilter {
  if (!value || value === ALL_CATEGORIES) return { kind: 'all' }

  if (value.startsWith('dept:')) {
    return { kind: 'department', department: value.slice('dept:'.length) }
  }

  if (value.startsWith('cat:')) {
    const rest = value.slice('cat:'.length)
    const at = rest.indexOf(SEPARATOR)
    if (at === -1) return { kind: 'legacyCategory', category: rest }
    return {
      kind: 'category',
      department: rest.slice(0, at),
      category: rest.slice(at + SEPARATOR.length),
    }
  }

  return { kind: 'legacyCategory', category: value }
}

/** Does this ticket belong in the list under the current filter? */
export function matchesCategoryFilter(
  ticket: { ticket_type?: string | null; category?: string | null },
  value: CategoryFilterValue | null | undefined,
): boolean {
  const parsed = parseCategoryFilter(value)
  switch (parsed.kind) {
    case 'all':
      return true
    case 'department':
      return ticket.ticket_type === parsed.department
    case 'category':
      return (
        ticket.ticket_type === parsed.department &&
        ticket.category === parsed.category
      )
    case 'legacyCategory':
      return ticket.category === parsed.category
  }
}
