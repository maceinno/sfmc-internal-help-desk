'use client'

import * as React from 'react'
import { useForm, Controller } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { Link2, AlertCircle } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { UserAutocomplete } from '@/components/shared/user-autocomplete'
import { FileUpload } from '@/components/shared/file-upload'
import { CustomFieldRenderer } from '@/components/create-ticket/custom-field-renderer'
import { evaluateConditions } from '@/lib/custom-fields/conditions'

import { useCreateTicket, type CreateTicketPayload } from '@/hooks/use-tickets'
import { useCustomFields, useDepartmentCategories } from '@/hooks/use-admin-config'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useUsers } from '@/hooks/use-users'
import { useTicket } from '@/hooks/use-tickets'
import { useUIStore } from '@/stores/ui-store'

import {
  DEFAULT_TICKET_TYPE_FIELD_CONFIGS,
  US_STATES,
  type CategoryOption,
} from '@/data/ticket-config'

import type {
  TicketType,
  TicketPriority,
  CustomFieldValue,
} from '@/types'

// ── Zod schema ──────────────────────────────────────────────────

const createTicketSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  ticketType: z.string().min(1, 'Please select a department'),
  category: z.string().min(1, 'Please select a category'),
  subCategory: z.string().optional(),
  priority: z.enum(['urgent', 'high', 'medium', 'low']),
})

type FormValues = z.infer<typeof createTicketSchema>

// ── Priority labels ─────────────────────────────────────────────

const PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: 'low', label: 'Low - General question or non-urgent request' },
  { value: 'medium', label: 'Medium - Affects workflow but has workaround' },
  { value: 'high', label: 'High - Blocking loan processing or closing' },
  { value: 'urgent', label: 'Urgent - System down / Closing at risk today' },
]

// ── Component ───────────────────────────────────────────────────

export function CreateTicketForm() {
  const router = useRouter()
  const { profile, isLoading: isUserLoading } = useCurrentUser()
  const { data: allUsers = [] } = useUsers()
  const { data: customFields = [] } = useCustomFields()
  const { data: departmentGroups = [] } = useDepartmentCategories()
  const createTicket = useCreateTicket()

  const ticketTypes = React.useMemo(
    () => departmentGroups.map((g) => g.ticket_type),
    [departmentGroups],
  )
  const departmentCategoriesMap = React.useMemo(() => {
    const map: Record<string, CategoryOption[]> = {}
    for (const g of departmentGroups) map[g.ticket_type] = g.categories
    return map
  }, [departmentGroups])

  // Follow-up mode
  const followUpFromTicketId = useUIStore((s) => s.followUpFromTicketId)
  const setFollowUpFromTicketId = useUIStore((s) => s.setFollowUpFromTicketId)
  const { data: followUpTicket } = useTicket(followUpFromTicketId)

  // Local state for fields not covered by react-hook-form
  const [ccRecipientIds, setCcRecipientIds] = React.useState<string[]>([])
  const [files, setFiles] = React.useState<File[]>([])
  const [customFieldValues, setCustomFieldValues] = React.useState<CustomFieldValue[]>([])
  const [mailingAddress, setMailingAddress] = React.useState({
    street1: '',
    street2: '',
    city: '',
    state: '',
    zip: '',
  })

  // ── React Hook Form ──────────────────────────────────────────

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: standardSchemaResolver(createTicketSchema),
    defaultValues: {
      title: '',
      description: '',
      ticketType: '',
      category: '',
      subCategory: '',
      priority: 'low',
    },
  })

  const ticketType = watch('ticketType')
  const category = watch('category')
  const subCategory = watch('subCategory')
  const priority = watch('priority')

  // ── Follow-up pre-fill ───────────────────────────────────────

  const hasPreFilled = React.useRef(false)

  React.useEffect(() => {
    if (followUpTicket && !hasPreFilled.current) {
      hasPreFilled.current = true
      setValue('title', `Follow-up: ${followUpTicket.title}`)
      setValue('description', `Follow-up to ticket #${followUpTicket.id}\n\n`)
      if (followUpTicket.ticket_type) {
        setValue('ticketType', followUpTicket.ticket_type)
      }
      if (followUpTicket.category) {
        setValue('category', followUpTicket.category)
      }
      if (followUpTicket.sub_category) {
        setValue('subCategory', followUpTicket.sub_category)
      }
      if (followUpTicket.priority) {
        setValue('priority', followUpTicket.priority)
      }
      if (followUpTicket.cc) {
        setCcRecipientIds(followUpTicket.cc)
      }
    }
  }, [followUpTicket, setValue])

  // ── Reset category when ticket type changes ──────────────────

  const prevTicketType = React.useRef(ticketType)

  React.useEffect(() => {
    if (prevTicketType.current !== ticketType) {
      prevTicketType.current = ticketType
      setValue('category', '')
      setValue('subCategory', '')
    }
  }, [ticketType, setValue])

  // ── Auto-set priority when type hides it ─────────────────────

  const fieldConfig = DEFAULT_TICKET_TYPE_FIELD_CONFIGS[ticketType]
  const showPriority = fieldConfig?.showPriority !== false

  React.useEffect(() => {
    if (!showPriority) {
      setValue('priority', fieldConfig?.defaultPriority ?? 'medium')
    }
  }, [showPriority, fieldConfig, setValue])

  // ── Derived data ─────────────────────────────────────────────

  const departmentCategories: CategoryOption[] =
    departmentCategoriesMap[ticketType] ?? []

  const selectedCategoryOption = departmentCategories.find(
    (c) => c.name === category,
  )
  const subCategoryOptions = selectedCategoryOption?.subCategories ?? []

  const showMailingAddress = category === 'New Hire'

  // Filter custom fields based on user role, ticket type, and per-field
  // display conditions. Conditions evaluate against the live form state so
  // fields can appear/disappear as the user changes category, priority, etc.
  const visibleCustomFields = React.useMemo(() => {
    if (!profile) return []
    const ctx = { ticketType, category, subCategory, priority }
    return customFields
      .filter((field) => {
        if (!field.enabled) return false
        if (!field.visible_to_roles.includes(profile.role)) return false
        if (
          field.visible_to_departments &&
          field.visible_to_departments.length > 0
        ) {
          if (!field.visible_to_departments.includes(ticketType)) return false
        }
        if (!evaluateConditions(field.conditions, ctx)) return false
        return true
      })
      .sort((a, b) => a.sort_order - b.sort_order)
  }, [customFields, profile, ticketType, category, subCategory, priority])

  // ── Custom field helpers ─────────────────────────────────────

  const getCustomFieldValue = (fieldId: string) => {
    return customFieldValues.find((v) => v.field_id === fieldId)?.value
  }

  const setCustomFieldValue = (
    fieldId: string,
    value: string | string[] | boolean | number | null,
  ) => {
    setCustomFieldValues((prev) => {
      const idx = prev.findIndex((v) => v.field_id === fieldId)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], value }
        return next
      }
      return [...prev, { field_id: fieldId, value }]
    })
  }

  // ── File helpers ─────────────────────────────────────────────

  const handleFilesSelected = (newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles])
  }

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const existingFiles = files.map((f) => ({
    name: f.name,
    size: f.size,
    type: f.type,
  }))

  // ── CC helpers ───────────────────────────────────────────────

  const handleCcSelect = (userId: string) => {
    if (!ccRecipientIds.includes(userId)) {
      setCcRecipientIds((prev) => [...prev, userId])
    }
  }

  const handleCcRemove = (userId: string) => {
    setCcRecipientIds((prev) => prev.filter((id) => id !== userId))
  }

  // ── Submit ───────────────────────────────────────────────────

  const onSubmit = async (data: FormValues) => {
    // Strip values for fields that are currently hidden by display conditions
    // so we don't persist stale input from a prior category/priority choice.
    const visibleFieldIds = new Set(visibleCustomFields.map((f) => f.id))
    const submittedCustomFields = customFieldValues.filter((v) =>
      visibleFieldIds.has(v.field_id),
    )

    const payload: CreateTicketPayload = {
      title: data.title,
      description: data.description,
      priority: data.priority as TicketPriority,
      category: data.category as any,
      ticketType: data.ticketType,
      subCategory: data.subCategory || undefined,
      attachments: files.length > 0 ? files : undefined,
      cc: ccRecipientIds.length > 0 ? ccRecipientIds : undefined,
      customFields: submittedCustomFields.length > 0 ? submittedCustomFields : undefined,
      mailingAddress: showMailingAddress && mailingAddress.street1
        ? mailingAddress
        : undefined,
      parentTicketId: followUpFromTicketId || undefined,
    }

    const newTicket = await createTicket.mutateAsync(payload)

    // Clear follow-up state
    if (followUpFromTicketId) {
      setFollowUpFromTicketId(null)
    }

    router.push(`/tickets/${newTicket.id}`)
  }

  const handleCancel = () => {
    if (followUpFromTicketId) {
      setFollowUpFromTicketId(null)
    }
    router.back()
  }

  // ── Loading state ────────────────────────────────────────────

  if (isUserLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Loading...
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {followUpTicket ? 'Create Follow-Up Ticket' : 'Submit a Support Request'}
        </h1>
        <p className="text-muted-foreground mt-1">
          {followUpTicket
            ? 'This ticket will be linked to the original for context.'
            : 'Describe your issue and our operations team will assist you.'}
        </p>
      </div>

      {/* Follow-up banner */}
      {followUpTicket && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <Link2 className="mt-0.5 size-5 shrink-0 text-blue-600" />
          <div>
            <p className="text-sm font-medium text-blue-900">
              Follow-up to #{followUpTicket.id}
            </p>
            <p className="mt-0.5 text-sm text-blue-700">
              {followUpTicket.title}
            </p>
            <p className="mt-1 text-xs text-blue-500">
              The new agent will be able to see all previous messages from the
              original ticket.
            </p>
          </div>
        </div>
      )}

      {/* Form */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* 1. Title */}
            <div className="space-y-1.5">
              <Label htmlFor="title">
                Subject <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                placeholder="Brief summary of the issue"
                aria-invalid={!!errors.title}
                {...register('title')}
              />
              {errors.title && (
                <p className="flex items-center gap-1 text-sm text-destructive">
                  <AlertCircle className="size-4" />
                  {errors.title.message}
                </p>
              )}
            </div>

            {/* 2. Description */}
            <div className="space-y-1.5">
              <Label htmlFor="description">
                Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="description"
                rows={6}
                placeholder="Include loan file numbers, borrower names, system error messages, or any relevant details..."
                aria-invalid={!!errors.description}
                {...register('description')}
              />
              {errors.description && (
                <p className="flex items-center gap-1 text-sm text-destructive">
                  <AlertCircle className="size-4" />
                  {errors.description.message}
                </p>
              )}
            </div>

            {/* 3. Ticket Type / Department */}
            <div className="space-y-1.5">
              <Label htmlFor="ticketType">
                Choose a Department <span className="text-destructive">*</span>
              </Label>
              <Controller
                name="ticketType"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(val) => field.onChange(val)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select department..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ticketTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.ticketType && (
                <p className="flex items-center gap-1 text-sm text-destructive">
                  <AlertCircle className="size-4" />
                  {errors.ticketType.message}
                </p>
              )}
            </div>

            {/* 4. Category */}
            {departmentCategories.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="category">
                  Category <span className="text-destructive">*</span>
                </Label>
                <Controller
                  name="category"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(val) => {
                        field.onChange(val)
                        // Reset sub-category when category changes
                        setValue('subCategory', '')
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a category..." />
                      </SelectTrigger>
                      <SelectContent>
                        {departmentCategories.map((cat) => (
                          <SelectItem key={cat.name} value={cat.name}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.category && (
                  <p className="flex items-center gap-1 text-sm text-destructive">
                    <AlertCircle className="size-4" />
                    {errors.category.message}
                  </p>
                )}
              </div>
            )}

            {/* 5. Sub-category */}
            {subCategoryOptions.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="subCategory">Sub-category</Label>
                <Controller
                  name="subCategory"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value ?? ''}
                      onValueChange={(val) => field.onChange(val)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a sub-category..." />
                      </SelectTrigger>
                      <SelectContent>
                        {subCategoryOptions.map((sub) => (
                          <SelectItem key={sub} value={sub}>
                            {sub}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}

            {/* 6. Priority */}
            {showPriority && (
              <div className="space-y-1.5">
                <Label htmlFor="priority">Priority</Label>
                <Controller
                  name="priority"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(val) => field.onChange(val)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select priority..." />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}

            {/* 7. CC Recipients */}
            <div className="space-y-1.5">
              <Label>CC</Label>
              <UserAutocomplete
                users={allUsers}
                selectedIds={ccRecipientIds}
                onSelect={handleCcSelect}
                onRemove={handleCcRemove}
                placeholder="Search users to CC..."
                multiple
                excludeIds={profile ? [profile.id] : []}
              />
              <p className="text-xs text-muted-foreground">
                Select users who should receive updates on this ticket.
              </p>
            </div>

            {/* 8. Custom Fields */}
            {visibleCustomFields.length > 0 && (
              <div className="space-y-4 border-t pt-4">
                <h3 className="flex items-center text-sm font-semibold text-gray-700">
                  <span className="mr-2 size-2 rounded-full bg-blue-500" />
                  Additional Information
                </h3>
                {visibleCustomFields.map((field) => (
                  <CustomFieldRenderer
                    key={field.id}
                    field={field}
                    value={getCustomFieldValue(field.id)}
                    onChange={(value) => setCustomFieldValue(field.id, value)}
                  />
                ))}
              </div>
            )}

            {/* 9. Attachments */}
            <div className="space-y-1.5">
              <Label>Attachments</Label>
              <FileUpload
                onFilesSelected={handleFilesSelected}
                existingFiles={existingFiles}
                onRemoveFile={handleRemoveFile}
                maxSizeMB={20}
                multiple
              />
            </div>

            {/* 10. Mailing Address */}
            {showMailingAddress && (
              <div className="space-y-3 border-t pt-4">
                <h3 className="flex items-center text-sm font-semibold text-gray-700">
                  <span className="mr-2 size-2 rounded-full bg-amber-500" />
                  Mailing Address
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    (for hardware shipping)
                  </span>
                </h3>

                <div className="space-y-1.5">
                  <Label htmlFor="street1">Street Address</Label>
                  <Input
                    id="street1"
                    value={mailingAddress.street1}
                    onChange={(e) =>
                      setMailingAddress((prev) => ({
                        ...prev,
                        street1: e.target.value,
                      }))
                    }
                    placeholder="123 Main St"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="street2">
                    Street Address Line 2{' '}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    id="street2"
                    value={mailingAddress.street2}
                    onChange={(e) =>
                      setMailingAddress((prev) => ({
                        ...prev,
                        street2: e.target.value,
                      }))
                    }
                    placeholder="Suite, Apt, Unit, etc."
                  />
                </div>

                <div className="grid grid-cols-6 gap-3">
                  <div className="col-span-3 space-y-1.5">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={mailingAddress.city}
                      onChange={(e) =>
                        setMailingAddress((prev) => ({
                          ...prev,
                          city: e.target.value,
                        }))
                      }
                      placeholder="City"
                    />
                  </div>

                  <div className="col-span-1 space-y-1.5">
                    <Label htmlFor="state">State</Label>
                    <Select
                      value={mailingAddress.state}
                      onValueChange={(val) =>
                        setMailingAddress((prev) => ({
                          ...prev,
                          state: val as string,
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="--" />
                      </SelectTrigger>
                      <SelectContent>
                        {US_STATES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-2 space-y-1.5">
                    <Label htmlFor="zip">ZIP Code</Label>
                    <Input
                      id="zip"
                      value={mailingAddress.zip}
                      onChange={(e) =>
                        setMailingAddress((prev) => ({
                          ...prev,
                          zip: e.target.value,
                        }))
                      }
                      placeholder="12345"
                      maxLength={10}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 border-t pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSubmitting || createTicket.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || createTicket.isPending}
              >
                {isSubmitting || createTicket.isPending
                  ? 'Submitting...'
                  : followUpTicket
                    ? 'Create Follow-Up'
                    : 'Submit Ticket'}
              </Button>
            </div>

            {/* Server error */}
            {createTicket.isError && (
              <p className="flex items-center gap-1 text-sm text-destructive">
                <AlertCircle className="size-4" />
                {createTicket.error instanceof Error
                  ? createTicket.error.message
                  : 'Failed to create ticket. Please try again.'}
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
