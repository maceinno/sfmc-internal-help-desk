import type {
  ConditionFieldKey,
  ConditionOperator,
  CustomFieldConditions,
  FieldCondition,
} from '@/types/ticket'

/** Values from the ticket form that rules can reference. */
export interface ConditionContext {
  ticketType?: string
  category?: string
  subCategory?: string
  priority?: string
}

export const CONDITION_FIELD_LABELS: Record<ConditionFieldKey, string> = {
  ticketType: 'Department',
  category: 'Category',
  subCategory: 'Sub-category',
  priority: 'Priority',
}

export const CONDITION_OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: 'is',
  notEquals: 'is not',
  in: 'is one of',
  notIn: 'is not one of',
  isEmpty: 'is empty',
  isNotEmpty: 'is not empty',
}

/** Operators that don't need a `value`. */
export const VALUELESS_OPERATORS: ConditionOperator[] = ['isEmpty', 'isNotEmpty']

/** Operators that accept a list of values. */
export const MULTI_VALUE_OPERATORS: ConditionOperator[] = ['in', 'notIn']

/** Evaluate one rule against the form context. */
function evaluateRule(rule: FieldCondition, ctx: ConditionContext): boolean {
  const actual = ctx[rule.field]

  switch (rule.operator) {
    case 'isEmpty':
      return actual == null || actual === ''
    case 'isNotEmpty':
      return actual != null && actual !== ''
    case 'equals':
      return typeof rule.value === 'string' && actual === rule.value
    case 'notEquals':
      return typeof rule.value === 'string' && actual !== rule.value
    case 'in':
      return (
        Array.isArray(rule.value) &&
        typeof actual === 'string' &&
        rule.value.includes(actual)
      )
    case 'notIn':
      return (
        Array.isArray(rule.value) &&
        typeof actual === 'string' &&
        !rule.value.includes(actual)
      )
    default:
      return true
  }
}

/**
 * Evaluate a condition group against the current ticket form state. When
 * there are no rules the field is visible (no restrictions).
 */
export function evaluateConditions(
  conditions: CustomFieldConditions | null | undefined,
  ctx: ConditionContext,
): boolean {
  if (!conditions || conditions.rules.length === 0) return true
  if (conditions.mode === 'any') {
    return conditions.rules.some((r) => evaluateRule(r, ctx))
  }
  return conditions.rules.every((r) => evaluateRule(r, ctx))
}
