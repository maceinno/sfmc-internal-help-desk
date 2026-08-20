// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  ALL_CATEGORIES,
  categoryFilterValue,
  departmentFilterValue,
  matchesCategoryFilter,
  parseCategoryFilter,
} from '@/lib/tickets/category-filter'

// Real rows from the live ticket table.
const itOther = { ticket_type: 'IT Support', category: 'Other' }
const marketingOther = { ticket_type: 'Marketing Support', category: 'Other' }
const lendingException = {
  ticket_type: 'Lending Support',
  category: 'Exception Request',
}
const secondaryExtension = {
  ticket_type: 'Secondary Support',
  category: 'Extension',
}

describe('the old behaviour is gone', () => {
  // The defect: the dropdown offered department names but the filter compared
  // them to ticket.category. No ticket in the live data has a category equal
  // to a department name, so every option returned an empty list.
  it('a bare department name no longer silently matches nothing useful', () => {
    // Under the old code this was the value being compared against category.
    const asDepartment = departmentFilterValue('Lending Support')
    expect(matchesCategoryFilter(lendingException, asDepartment)).toBe(true)
    expect(matchesCategoryFilter(itOther, asDepartment)).toBe(false)
  })
})

describe('matchesCategoryFilter', () => {
  it('lets everything through when nothing is selected', () => {
    for (const t of [itOther, marketingOther, lendingException]) {
      expect(matchesCategoryFilter(t, ALL_CATEGORIES)).toBe(true)
      expect(matchesCategoryFilter(t, null)).toBe(true)
      expect(matchesCategoryFilter(t, undefined)).toBe(true)
    }
  })

  it('filters to a whole department', () => {
    const value = departmentFilterValue('Secondary Support')
    expect(matchesCategoryFilter(secondaryExtension, value)).toBe(true)
    expect(matchesCategoryFilter(lendingException, value)).toBe(false)
  })

  it('filters to one category inside one department', () => {
    const value = categoryFilterValue('Lending Support', 'Exception Request')
    expect(matchesCategoryFilter(lendingException, value)).toBe(true)
    expect(matchesCategoryFilter(secondaryExtension, value)).toBe(false)
  })

  // Nine of the ten departments define an "Other". Picking one department's
  // must not drag in the others — there are 659 "Other" tickets in total.
  it('keeps same-named categories in different departments apart', () => {
    const marketing = categoryFilterValue('Marketing Support', 'Other')
    expect(matchesCategoryFilter(marketingOther, marketing)).toBe(true)
    expect(matchesCategoryFilter(itOther, marketing)).toBe(false)

    const it = categoryFilterValue('IT Support', 'Other')
    expect(matchesCategoryFilter(itOther, it)).toBe(true)
    expect(matchesCategoryFilter(marketingOther, it)).toBe(false)
  })

  it('handles department and category names containing punctuation', () => {
    const t = {
      ticket_type: 'Product Desk (Non-Agency Products)',
      category: 'Other Product',
    }
    const value = categoryFilterValue(
      'Product Desk (Non-Agency Products)',
      'Other Product',
    )
    expect(matchesCategoryFilter(t, value)).toBe(true)

    const mlm = {
      ticket_type: 'System Support',
      category: 'Meridian Link Mortgage (MLM)',
    }
    expect(
      matchesCategoryFilter(
        mlm,
        categoryFilterValue('System Support', 'Meridian Link Mortgage (MLM)'),
      ),
    ).toBe(true)
  })

  it('does not match a ticket with no category set', () => {
    expect(
      matchesCategoryFilter(
        { ticket_type: 'IT Support', category: null },
        categoryFilterValue('IT Support', 'Other'),
      ),
    ).toBe(false)
    // …but the department filter still includes it.
    expect(
      matchesCategoryFilter(
        { ticket_type: 'IT Support', category: null },
        departmentFilterValue('IT Support'),
      ),
    ).toBe(true)
  })

  it('falls back to a plain category match for an unrecognised value', () => {
    expect(matchesCategoryFilter(itOther, 'Other')).toBe(true)
    expect(matchesCategoryFilter(lendingException, 'Other')).toBe(false)
  })
})

describe('parseCategoryFilter', () => {
  it('reads each shape back', () => {
    expect(parseCategoryFilter(ALL_CATEGORIES)).toEqual({ kind: 'all' })
    expect(parseCategoryFilter(departmentFilterValue('IT Support'))).toEqual({
      kind: 'department',
      department: 'IT Support',
    })
    expect(
      parseCategoryFilter(categoryFilterValue('IT Support', 'Add Access')),
    ).toEqual({
      kind: 'category',
      department: 'IT Support',
      category: 'Add Access',
    })
    expect(parseCategoryFilter('Post Closing')).toEqual({
      kind: 'legacyCategory',
      category: 'Post Closing',
    })
  })
})
