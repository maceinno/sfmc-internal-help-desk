'use client'

import * as React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type {
  ConditionFieldKey,
  ConditionOperator,
  CustomFieldConditions,
  FieldCondition,
} from '@/types/ticket'
import {
  CONDITION_FIELD_LABELS,
  CONDITION_OPERATOR_LABELS,
  MULTI_VALUE_OPERATORS,
  VALUELESS_OPERATORS,
} from '@/lib/custom-fields/conditions'

const FIELDS: ConditionFieldKey[] = [
  'ticketType',
  'category',
  'subCategory',
  'priority',
]

const OPERATORS: ConditionOperator[] = [
  'equals',
  'notEquals',
  'in',
  'notIn',
  'isEmpty',
  'isNotEmpty',
]

const PRIORITIES = ['urgent', 'high', 'medium', 'low']

interface Props {
  value: CustomFieldConditions | null | undefined
  onChange: (next: CustomFieldConditions | null) => void
  /** Available ticket types/departments from Admin → Departments & Categories. */
  ticketTypes: string[]
  /** Categories keyed by ticket type. */
  categoriesByType: Record<string, string[]>
  /** Sub-categories keyed by `${ticketType}::${category}`. */
  subCategoriesByKey: Record<string, string[]>
}

function emptyRule(): FieldCondition {
  return { field: 'category', operator: 'equals', value: '' }
}

function allCategoryNames(categoriesByType: Record<string, string[]>): string[] {
  const set = new Set<string>()
  for (const list of Object.values(categoriesByType)) {
    for (const c of list) set.add(c)
  }
  return Array.from(set).sort()
}

function allSubCategoryNames(
  subCategoriesByKey: Record<string, string[]>,
): string[] {
  const set = new Set<string>()
  for (const list of Object.values(subCategoriesByKey)) {
    for (const s of list) set.add(s)
  }
  return Array.from(set).sort()
}

export function CustomFieldConditionsEditor({
  value,
  onChange,
  ticketTypes,
  categoriesByType,
  subCategoriesByKey,
}: Props) {
  const conditions: CustomFieldConditions = value ?? { mode: 'all', rules: [] }

  const update = (next: CustomFieldConditions) => {
    onChange(next.rules.length === 0 ? null : next)
  }

  const addRule = () => {
    update({ ...conditions, rules: [...conditions.rules, emptyRule()] })
  }

  const removeRule = (index: number) => {
    update({
      ...conditions,
      rules: conditions.rules.filter((_, i) => i !== index),
    })
  }

  const patchRule = (index: number, patch: Partial<FieldCondition>) => {
    update({
      ...conditions,
      rules: conditions.rules.map((r, i) =>
        i === index ? { ...r, ...patch } : r,
      ),
    })
  }

  const optionsForField = (field: ConditionFieldKey): string[] => {
    switch (field) {
      case 'ticketType':
        return ticketTypes
      case 'category':
        return allCategoryNames(categoriesByType)
      case 'subCategory':
        return allSubCategoryNames(subCategoriesByKey)
      case 'priority':
        return PRIORITIES
    }
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-semibold">Display conditions</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Show this field only when the rules below match. Leave empty to
            always show it (subject to role / department visibility).
          </p>
        </div>
        {conditions.rules.length > 1 && (
          <Select
            value={conditions.mode}
            onValueChange={(mode) =>
              update({ ...conditions, mode: mode as 'all' | 'any' })
            }
          >
            <SelectTrigger className="h-7 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Match all</SelectItem>
              <SelectItem value="any">Match any</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {conditions.rules.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          No conditions — field is always visible.
        </p>
      )}

      {conditions.rules.map((rule, i) => {
        const isValueless = VALUELESS_OPERATORS.includes(rule.operator)
        const isMultiValue = MULTI_VALUE_OPERATORS.includes(rule.operator)
        const options = optionsForField(rule.field)

        return (
          <div
            key={i}
            className="flex flex-wrap items-center gap-2 rounded-md border bg-white p-2"
          >
            {i > 0 && (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {conditions.mode === 'all' ? 'AND' : 'OR'}
              </span>
            )}

            <Select
              value={rule.field}
              onValueChange={(field) =>
                patchRule(i, {
                  field: field as ConditionFieldKey,
                  value: '',
                })
              }
            >
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELDS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {CONDITION_FIELD_LABELS[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={rule.operator}
              onValueChange={(op) =>
                patchRule(i, {
                  operator: op as ConditionOperator,
                  // Reset value when switching between shapes
                  value: VALUELESS_OPERATORS.includes(op as ConditionOperator)
                    ? null
                    : MULTI_VALUE_OPERATORS.includes(op as ConditionOperator)
                      ? []
                      : '',
                })
              }
            >
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPERATORS.map((op) => (
                  <SelectItem key={op} value={op}>
                    {CONDITION_OPERATOR_LABELS[op]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {!isValueless && !isMultiValue && (
              options.length > 0 ? (
                <Select
                  value={(rule.value as string) ?? ''}
                  onValueChange={(v) => patchRule(i, { value: v })}
                >
                  <SelectTrigger className="h-8 min-w-40 text-xs">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  className="h-8 w-40 text-xs"
                  value={(rule.value as string) ?? ''}
                  onChange={(e) => patchRule(i, { value: e.target.value })}
                />
              )
            )}

            {isMultiValue && (
              <MultiValuePicker
                value={Array.isArray(rule.value) ? rule.value : []}
                options={options}
                onChange={(next) => patchRule(i, { value: next })}
              />
            )}

            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => removeRule(i)}
              className="ml-auto text-muted-foreground hover:text-destructive"
              aria-label="Remove condition"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        )
      })}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addRule}
        className="w-full border-dashed"
      >
        <Plus className="size-3.5 mr-1.5" />
        Add condition
      </Button>
    </div>
  )
}

interface MultiValuePickerProps {
  value: string[]
  options: string[]
  onChange: (next: string[]) => void
}

function MultiValuePicker({ value, options, onChange }: MultiValuePickerProps) {
  const toggle = (opt: string) => {
    onChange(
      value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt],
    )
  }
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((opt) => {
        const selected = value.includes(opt)
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors ${
              selected
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}
