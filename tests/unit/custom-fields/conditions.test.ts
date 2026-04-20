import { describe, expect, it } from 'vitest'
import { evaluateConditions } from '@/lib/custom-fields/conditions'
import type { CustomFieldConditions } from '@/types'

const ctx = {
  ticketType: 'IT Support',
  category: 'Hardware Request',
  subCategory: 'Laptop',
  priority: 'high',
}

describe('evaluateConditions', () => {
  it('returns true when conditions are null', () => {
    expect(evaluateConditions(null, ctx)).toBe(true)
  })

  it('returns true when rules list is empty', () => {
    expect(evaluateConditions({ mode: 'all', rules: [] }, ctx)).toBe(true)
  })

  it('AND mode requires every rule to match', () => {
    const conds: CustomFieldConditions = {
      mode: 'all',
      rules: [
        { field: 'ticketType', operator: 'equals', value: 'IT Support' },
        { field: 'priority', operator: 'equals', value: 'high' },
      ],
    }
    expect(evaluateConditions(conds, ctx)).toBe(true)
    expect(evaluateConditions(conds, { ...ctx, priority: 'low' })).toBe(false)
  })

  it('OR mode requires any rule to match', () => {
    const conds: CustomFieldConditions = {
      mode: 'any',
      rules: [
        { field: 'priority', operator: 'equals', value: 'urgent' },
        { field: 'category', operator: 'equals', value: 'Hardware Request' },
      ],
    }
    expect(evaluateConditions(conds, ctx)).toBe(true)
    expect(
      evaluateConditions(conds, { ...ctx, category: 'Other', priority: 'low' }),
    ).toBe(false)
  })

  it('supports in / notIn with array value', () => {
    const inRule: CustomFieldConditions = {
      mode: 'all',
      rules: [
        { field: 'priority', operator: 'in', value: ['high', 'urgent'] },
      ],
    }
    expect(evaluateConditions(inRule, ctx)).toBe(true)
    expect(evaluateConditions(inRule, { ...ctx, priority: 'low' })).toBe(false)

    const notInRule: CustomFieldConditions = {
      mode: 'all',
      rules: [
        { field: 'priority', operator: 'notIn', value: ['low', 'medium'] },
      ],
    }
    expect(evaluateConditions(notInRule, ctx)).toBe(true)
    expect(evaluateConditions(notInRule, { ...ctx, priority: 'low' })).toBe(
      false,
    )
  })

  it('isEmpty and isNotEmpty do not require a value', () => {
    const emptyRule: CustomFieldConditions = {
      mode: 'all',
      rules: [{ field: 'subCategory', operator: 'isEmpty' }],
    }
    expect(evaluateConditions(emptyRule, { ...ctx, subCategory: '' })).toBe(true)
    expect(evaluateConditions(emptyRule, ctx)).toBe(false)

    const notEmptyRule: CustomFieldConditions = {
      mode: 'all',
      rules: [{ field: 'subCategory', operator: 'isNotEmpty' }],
    }
    expect(evaluateConditions(notEmptyRule, ctx)).toBe(true)
    expect(evaluateConditions(notEmptyRule, { ...ctx, subCategory: '' })).toBe(
      false,
    )
  })
})
