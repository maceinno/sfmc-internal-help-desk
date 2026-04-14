'use client'

import { useState, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClerkSupabaseClient } from '@/lib/supabase/client'
import { useCustomFields } from '@/hooks/use-admin-config'
import type { CustomField, CustomFieldType, TicketType } from '@/types'
import { toast } from 'sonner'
import {
  Plus,
  Trash2,
  FileText,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  X,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ── Constants ───────────────────────────────────────────────────

const FIELD_TYPE_OPTIONS: { value: CustomFieldType; label: string }[] = [
  { value: 'text', label: 'Text (Single Line)' },
  { value: 'textarea', label: 'Text Area (Multi-line)' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Select (Dropdown)' },
  { value: 'multiselect', label: 'Multi-Select' },
  { value: 'checkbox', label: 'Checkbox' },
]

const ROLES = ['employee', 'agent', 'admin'] as const

const TICKET_TYPES: TicketType[] = [
  'Closing Support',
  'IT Support',
  'Lending Support',
  'Marketing Support',
  'Payoff Request',
  'Product Desk (Non-Agency Products)',
  'Secondary Support',
]

// ── Helpers ─────────────────────────────────────────────────────

function emptyField(): Partial<CustomField> {
  return {
    name: '',
    label: '',
    field_type: 'text',
    required: false,
    options: [],
    help_text: '',
    placeholder: '',
    default_value: '',
    visible_to_roles: ['agent'],
    visible_to_departments: [],
    enabled: true,
  }
}

// ── Page ────────────────────────────────────────────────────────

export default function CustomFieldsPage() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const { data: fields, isLoading } = useCustomFields()

  // Dialog state
  const [editField, setEditField] = useState<Partial<CustomField> | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [newOptionInput, setNewOptionInput] = useState('')

  // ── Mutations ───────────────────────────────────────────────

  const upsertField = useMutation({
    mutationFn: async (field: Partial<CustomField> & { id?: string }) => {
      const token = await getToken({ template: 'supabase' })
      if (!token) throw new Error('No auth token')
      const supabase = createClerkSupabaseClient(token)

      const payload = {
        name: field.name,
        label: field.label,
        type: field.field_type,
        required: field.required,
        options: field.options ?? [],
        help_text: field.help_text,
        placeholder: field.placeholder,
        default_value: field.default_value,
        visible_to_roles: field.visible_to_roles,
        visible_to_departments: field.visible_to_departments,
        enabled: field.enabled,
        order: field.sort_order ?? 0,
      }

      if (field.id) {
        const { error } = await supabase
          .from('custom_fields')
          .update(payload)
          .eq('id', field.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('custom_fields')
          .insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'customFields'] })
    },
  })

  const deleteField = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken({ template: 'supabase' })
      if (!token) throw new Error('No auth token')
      const supabase = createClerkSupabaseClient(token)
      const { error } = await supabase
        .from('custom_fields')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'customFields'] })
    },
  })

  const reorderField = useMutation({
    mutationFn: async ({
      id,
      newOrder,
    }: {
      id: string
      newOrder: number
    }) => {
      const token = await getToken({ template: 'supabase' })
      if (!token) throw new Error('No auth token')
      const supabase = createClerkSupabaseClient(token)
      const { error } = await supabase
        .from('custom_fields')
        .update({ sort_order: newOrder })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'customFields'] })
    },
  })

  // ── Handlers ──────────────────────────────────────────────

  const openCreate = useCallback(() => {
    setEditField({
      ...emptyField(),
      sort_order: (fields?.length ?? 0),
    })
    setIsCreating(true)
    setNewOptionInput('')
  }, [fields])

  const openEdit = useCallback((field: CustomField) => {
    setEditField({ ...field })
    setIsCreating(false)
    setNewOptionInput('')
  }, [])

  const handleSave = useCallback(async () => {
    if (!editField) return
    if (!editField.name?.trim() || !editField.label?.trim()) {
      toast.error('Name and Label are required')
      return
    }
    try {
      await upsertField.mutateAsync(editField)
      toast.success(
        isCreating ? 'Custom field created' : 'Custom field updated',
      )
      setEditField(null)
    } catch {
      toast.error('Failed to save custom field')
    }
  }, [editField, isCreating, upsertField])

  const handleDelete = useCallback(
    async (field: CustomField) => {
      try {
        await deleteField.mutateAsync(field.id)
        toast.success(`Field "${field.label}" deleted`)
      } catch {
        toast.error('Failed to delete field')
      }
    },
    [deleteField],
  )

  const handleToggleEnabled = useCallback(
    async (field: CustomField) => {
      try {
        await upsertField.mutateAsync({
          ...field,
          enabled: !field.enabled,
        })
        toast.success(
          field.enabled ? 'Field disabled' : 'Field enabled',
        )
      } catch {
        toast.error('Failed to toggle field')
      }
    },
    [upsertField],
  )

  const handleMove = useCallback(
    async (field: CustomField, direction: 'up' | 'down') => {
      if (!fields) return
      const sorted = [...fields].sort((a, b) => a.sort_order - b.sort_order)
      const currentIdx = sorted.findIndex((f) => f.id === field.id)
      const swapIdx =
        direction === 'up' ? currentIdx - 1 : currentIdx + 1
      if (swapIdx < 0 || swapIdx >= sorted.length) return

      const other = sorted[swapIdx]
      try {
        await reorderField.mutateAsync({
          id: field.id,
          newOrder: other.sort_order,
        })
        await reorderField.mutateAsync({
          id: other.id,
          newOrder: field.sort_order,
        })
      } catch {
        toast.error('Failed to reorder')
      }
    },
    [fields, reorderField],
  )

  const addOption = useCallback(() => {
    const val = newOptionInput.trim()
    if (!val || !editField) return
    if (editField.options?.includes(val)) {
      toast.error('Option already exists')
      return
    }
    setEditField({
      ...editField,
      options: [...(editField.options ?? []), val],
    })
    setNewOptionInput('')
  }, [newOptionInput, editField])

  const removeOption = useCallback(
    (index: number) => {
      if (!editField) return
      const opts = [...(editField.options ?? [])]
      opts.splice(index, 1)
      setEditField({ ...editField, options: opts })
    },
    [editField],
  )

  const toggleRole = useCallback(
    (role: (typeof ROLES)[number]) => {
      if (!editField) return
      const roles = editField.visible_to_roles ?? []
      setEditField({
        ...editField,
        visible_to_roles: roles.includes(role)
          ? roles.filter((r) => r !== role)
          : [...roles, role],
      })
    },
    [editField],
  )

  const toggleDept = useCallback(
    (dept: string) => {
      if (!editField) return
      const depts = editField.visible_to_departments ?? []
      setEditField({
        ...editField,
        visible_to_departments: depts.includes(dept)
          ? depts.filter((d) => d !== dept)
          : [...depts, dept],
      })
    },
    [editField],
  )

  // ── Loading ───────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const sorted = fields
    ? [...fields].sort((a, b) => a.sort_order - b.sort_order)
    : []

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Custom Fields</h1>
          <p className="text-sm text-muted-foreground">
            Create custom fields that appear on ticket creation forms.
            Configure visibility for different user roles.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4 mr-1.5" />
          Add Custom Field
        </Button>
      </div>

      {/* Empty state */}
      {sorted.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-12 text-center">
          <FileText className="size-12 text-muted-foreground mb-3" />
          <p className="font-medium text-muted-foreground">
            No custom fields yet
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Create custom fields to collect additional information on
            tickets.
          </p>
        </div>
      )}

      {/* Fields list */}
      {sorted.map((field, idx) => (
        <Card key={field.id}>
          <CardHeader className="border-b bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <GripVertical className="size-4 text-muted-foreground" />
                <div>
                  <CardTitle>{field.label}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {field.name} &middot; {field.field_type}
                    {field.required && (
                      <Badge
                        variant="destructive"
                        className="ml-2 text-[10px]"
                      >
                        Required
                      </Badge>
                    )}
                    {!field.enabled && (
                      <Badge
                        variant="secondary"
                        className="ml-2 text-[10px]"
                      >
                        Disabled
                      </Badge>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {/* Reorder */}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  disabled={idx === 0}
                  onClick={() => handleMove(field, 'up')}
                  title="Move up"
                >
                  <ChevronUp className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  disabled={idx === sorted.length - 1}
                  onClick={() => handleMove(field, 'down')}
                  title="Move down"
                >
                  <ChevronDown className="size-4" />
                </Button>
                {/* Toggle */}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => handleToggleEnabled(field)}
                  title={field.enabled ? 'Disable' : 'Enable'}
                >
                  {field.enabled ? (
                    <Eye className="size-4 text-green-600" />
                  ) : (
                    <EyeOff className="size-4 text-muted-foreground" />
                  )}
                </Button>
                {/* Edit */}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => openEdit(field)}
                  title="Edit"
                >
                  <FileText className="size-4" />
                </Button>
                {/* Delete */}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => handleDelete(field)}
                  title="Delete"
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span>
                Roles:{' '}
                {field.visible_to_roles.map((r) => (
                  <Badge
                    key={r}
                    variant="outline"
                    className="ml-1 text-[10px] capitalize"
                  >
                    {r}
                  </Badge>
                ))}
              </span>
              <span>
                Departments:{' '}
                {field.visible_to_departments &&
                field.visible_to_departments.length > 0
                  ? field.visible_to_departments.map((d) => (
                      <Badge
                        key={d}
                        variant="outline"
                        className="ml-1 text-[10px]"
                      >
                        {d}
                      </Badge>
                    ))
                  : 'All'}
              </span>
              {field.options && field.options.length > 0 && (
                <span>
                  Options: {field.options.length}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* ── Edit / Create dialog ─────────────────────────── */}
      <Dialog
        open={!!editField}
        onOpenChange={(open) => {
          if (!open) setEditField(null)
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isCreating ? 'New Custom Field' : 'Edit Custom Field'}
            </DialogTitle>
            <DialogDescription>
              {isCreating
                ? 'Create a new custom field for ticket forms.'
                : 'Update this custom field\'s configuration.'}
            </DialogDescription>
          </DialogHeader>

          {editField && (
            <div className="space-y-4">
              {/* Name + Label */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>
                    Name (Internal) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={editField.name ?? ''}
                    onChange={(e) =>
                      setEditField({ ...editField, name: e.target.value })
                    }
                    placeholder="e.g. loan_number"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>
                    Label (Display) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={editField.label ?? ''}
                    onChange={(e) =>
                      setEditField({ ...editField, label: e.target.value })
                    }
                    placeholder="e.g. Loan Number"
                    className="mt-1.5"
                  />
                </div>
              </div>

              {/* Type */}
              <div>
                <Label>Field Type</Label>
                <Select
                  value={editField.field_type ?? 'text'}
                  onValueChange={(val) =>
                    setEditField({
                      ...editField,
                      field_type: val as CustomFieldType,
                    })
                  }
                >
                  <SelectTrigger className="w-full mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Options (select/multiselect) */}
              {(editField.field_type === 'select' ||
                editField.field_type === 'multiselect') && (
                <div>
                  <Label>Options</Label>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {(editField.options ?? []).map((opt, i) => (
                      <Badge
                        key={opt}
                        variant="secondary"
                        className="gap-1 pr-1"
                      >
                        {opt}
                        <button
                          type="button"
                          className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                          onClick={() => removeOption(i)}
                        >
                          <X className="size-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      value={newOptionInput}
                      onChange={(e) => setNewOptionInput(e.target.value)}
                      placeholder="Add option..."
                      className="h-7 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addOption()
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={addOption}
                    >
                      <Plus className="size-3 mr-1" />
                      Add
                    </Button>
                  </div>
                </div>
              )}

              {/* Default Value */}
              <div>
                <Label>Default Value</Label>
                <Input
                  value={
                    typeof editField.default_value === 'string'
                      ? editField.default_value
                      : ''
                  }
                  onChange={(e) =>
                    setEditField({
                      ...editField,
                      default_value: e.target.value,
                    })
                  }
                  placeholder="Leave empty for no default"
                  className="mt-1.5"
                />
              </div>

              {/* Placeholder + Help text */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Placeholder</Label>
                  <Input
                    value={editField.placeholder ?? ''}
                    onChange={(e) =>
                      setEditField({
                        ...editField,
                        placeholder: e.target.value,
                      })
                    }
                    placeholder="Placeholder text..."
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Help Text</Label>
                  <Input
                    value={editField.help_text ?? ''}
                    onChange={(e) =>
                      setEditField({
                        ...editField,
                        help_text: e.target.value,
                      })
                    }
                    placeholder="Guidance text..."
                    className="mt-1.5"
                  />
                </div>
              </div>

              {/* Visible to roles */}
              <div>
                <Label>Visible to Roles</Label>
                <div className="mt-1.5 flex gap-4">
                  {ROLES.map((role) => (
                    <label
                      key={role}
                      className="flex items-center gap-2 text-sm capitalize cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={(
                          editField.visible_to_roles ?? []
                        ).includes(role)}
                        onChange={() => toggleRole(role)}
                        className="size-4 rounded border-input"
                      />
                      {role}s
                    </label>
                  ))}
                </div>
              </div>

              {/* Visible to departments */}
              <div>
                <Label>
                  Visible to Departments{' '}
                  <span className="text-xs text-muted-foreground font-normal ml-1">
                    (none = all)
                  </span>
                </Label>
                <div className="mt-1.5 grid grid-cols-2 gap-2 rounded-lg border bg-muted/30 p-3">
                  {TICKET_TYPES.map((dept) => (
                    <label
                      key={dept}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={(
                          editField.visible_to_departments ?? []
                        ).includes(dept)}
                        onChange={() => toggleDept(dept)}
                        className="size-4 rounded border-input"
                      />
                      {dept}
                    </label>
                  ))}
                </div>
              </div>

              {/* Required + Enabled */}
              <div className="flex items-center gap-6 pt-2 border-t">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editField.required ?? false}
                    onCheckedChange={(checked) =>
                      setEditField({ ...editField, required: !!checked })
                    }
                  />
                  <Label className="font-normal">Required</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editField.enabled !== false}
                    onCheckedChange={(checked) =>
                      setEditField({ ...editField, enabled: !!checked })
                    }
                  />
                  <Label className="font-normal">Enabled</Label>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              onClick={handleSave}
              disabled={upsertField.isPending}
            >
              {isCreating ? 'Create Field' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
