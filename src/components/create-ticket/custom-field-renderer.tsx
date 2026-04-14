'use client'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CustomField } from '@/types'

interface CustomFieldRendererProps {
  field: CustomField
  value: string | string[] | boolean | number | null | undefined
  onChange: (value: string | string[] | boolean | number | null) => void
}

export function CustomFieldRenderer({ field, value, onChange }: CustomFieldRendererProps) {
  const id = `custom-field-${field.id}`

  return (
    <div className="space-y-1.5">
      {field.field_type !== 'checkbox' && (
        <Label htmlFor={id}>
          {field.label}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}

      {field.field_type === 'text' && (
        <Input
          id={id}
          type="text"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
        />
      )}

      {field.field_type === 'textarea' && (
        <Textarea
          id={id}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={3}
        />
      )}

      {field.field_type === 'number' && (
        <Input
          id={id}
          type="number"
          value={value != null ? String(value) : ''}
          onChange={(e) => {
            const parsed = parseFloat(e.target.value)
            onChange(Number.isNaN(parsed) ? null : parsed)
          }}
          placeholder={field.placeholder}
        />
      )}

      {field.field_type === 'date' && (
        <Input
          id={id}
          type="date"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {field.field_type === 'select' && (
        <Select
          value={(value as string) ?? ''}
          onValueChange={(val) => onChange(val)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={field.placeholder ?? 'Select an option...'} />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {field.field_type === 'multiselect' && (
        <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
          {field.options?.map((option) => {
            const selected = Array.isArray(value) ? value : []
            const isChecked = selected.includes(option)
            return (
              <label key={option} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onChange([...selected, option])
                    } else {
                      onChange(selected.filter((v) => v !== option))
                    }
                  }}
                  className="size-4 rounded border-input"
                />
                <span>{option}</span>
              </label>
            )
          })}
        </div>
      )}

      {field.field_type === 'checkbox' && (
        <div className="flex items-center gap-3">
          <Switch
            id={id}
            checked={(value as boolean) ?? false}
            onCheckedChange={(checked) => onChange(checked)}
          />
          <Label htmlFor={id} className="font-normal">
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
        </div>
      )}

      {field.help_text && field.field_type !== 'checkbox' && (
        <p className="text-xs text-muted-foreground">{field.help_text}</p>
      )}
    </div>
  )
}
