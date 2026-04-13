'use client'

import { useState, useMemo, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useQueryClient } from '@tanstack/react-query'
import {
  ChevronUp,
  ChevronDown,
  Plus,
  Trash2,
  Save,
  GripVertical,
  Settings,
  Loader2,
  Clock,
  Activity,
  AlertTriangle,
  FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import { useSlaPolicies } from '@/hooks/use-admin-config'
import { createClerkSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import type {
  SlaPolicy,
  SlaPolicyConditions,
  SlaPolicyMetrics,
  TicketType,
  TicketCategory,
  TicketPriority,
} from '@/types'
import { TICKET_TYPES } from '@/data/ticket-config'

// ── Constants ──────────────────────────────────────────────────

const TICKET_CATEGORIES: TicketCategory[] = [
  'Loan Origination',
  'Underwriting',
  'Closing',
  'Servicing',
  'Compliance',
  'IT Systems',
  'General',
]

const PRIORITIES: { value: TicketPriority; label: string }[] = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

// ── Helpers ────────────────────────────────────────────────────

function getSlaSummary(policy: SlaPolicy): string {
  const parts: string[] = []
  if (policy.conditions.ticketTypes !== 'any')
    parts.push(`Types: ${policy.conditions.ticketTypes.join(', ')}`)
  if (policy.conditions.categories !== 'any')
    parts.push(`Categories: ${policy.conditions.categories.join(', ')}`)
  if (policy.conditions.priorities !== 'any')
    parts.push(`Priorities: ${policy.conditions.priorities.join(', ')}`)
  return parts.length > 0 ? parts.join(' · ') : 'All tickets'
}

// ── Page component ─────────────────────────────────────────────

export default function SlaAdminPage() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const { data: slaPolicies = [], isLoading } = useSlaPolicies()

  const [localPolicies, setLocalPolicies] = useState<SlaPolicy[] | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [saving, setSaving] = useState(false)

  // New SLA form state
  const [newSlaName, setNewSlaName] = useState('')
  const [newSlaConditions, setNewSlaConditions] =
    useState<SlaPolicyConditions>({
      ticketTypes: 'any',
      categories: 'any',
      priorities: 'any',
    })
  const [newSlaMetrics, setNewSlaMetrics] = useState<SlaPolicyMetrics>({
    firstReplyHours: 4,
    nextReplyHours: 8,
    warningThreshold: 75,
  })

  const policies = localPolicies ?? slaPolicies
  const hasChanges = localPolicies !== null

  const sortedPolicies = useMemo(
    () => [...policies].sort((a, b) => a.order - b.order),
    [policies]
  )

  // ── Mutation helpers ───────────────────────────────────────

  const updatePolicies = useCallback(
    (updater: (prev: SlaPolicy[]) => SlaPolicy[]) => {
      setLocalPolicies((prev) => updater(prev ?? slaPolicies))
    },
    [slaPolicies]
  )

  const toggleSla = (id: string) => {
    updatePolicies((prev) =>
      prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    )
  }

  const updateSlaName = (id: string, name: string) => {
    updatePolicies((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name } : p))
    )
  }

  const updateSlaConditions = (
    id: string,
    conditions: SlaPolicyConditions
  ) => {
    updatePolicies((prev) =>
      prev.map((p) => (p.id === id ? { ...p, conditions } : p))
    )
  }

  const updateSlaMetrics = (id: string, metrics: SlaPolicyMetrics) => {
    updatePolicies((prev) =>
      prev.map((p) => (p.id === id ? { ...p, metrics } : p))
    )
  }

  const moveSla = (id: string, direction: 'up' | 'down') => {
    updatePolicies((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order)
      const idx = sorted.findIndex((p) => p.id === id)
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1
      if (swapIdx < 0 || swapIdx >= sorted.length) return prev
      const current = sorted[idx]
      const swap = sorted[swapIdx]
      return prev.map((p) => {
        if (p.id === current.id) return { ...p, order: swap.order }
        if (p.id === swap.id) return { ...p, order: current.order }
        return p
      })
    })
  }

  const deleteSla = (id: string) => {
    updatePolicies((prev) => prev.filter((p) => p.id !== id))
    if (editingId === id) setEditingId(null)
  }

  const addSla = () => {
    if (!newSlaName.trim()) return
    const currentPolicies = localPolicies ?? slaPolicies
    const newPolicy: SlaPolicy = {
      id: `custom-sla-${Date.now()}`,
      name: newSlaName.trim(),
      enabled: true,
      conditions: { ...newSlaConditions },
      metrics: { ...newSlaMetrics },
      order: currentPolicies.length,
      isDefault: false,
    }
    updatePolicies((prev) => [...prev, newPolicy])
    setNewSlaName('')
    setNewSlaConditions({
      ticketTypes: 'any',
      categories: 'any',
      priorities: 'any',
    })
    setNewSlaMetrics({
      firstReplyHours: 4,
      nextReplyHours: 8,
      warningThreshold: 75,
    })
    setShowAddDialog(false)
  }

  const handleSave = async () => {
    if (!localPolicies) return
    setSaving(true)
    try {
      const token = await getToken({ template: 'supabase' })
      if (!token) throw new Error('No auth token')
      const supabase = createClerkSupabaseClient(token)

      const { error } = await supabase.from('sla_policies').upsert(
        localPolicies.map((p) => ({
          id: p.id,
          name: p.name,
          enabled: p.enabled,
          conditions: p.conditions,
          metrics: p.metrics,
          display_order: p.order,
          is_default: p.isDefault ?? false,
        }))
      )
      if (error) throw error

      // Delete removed policies
      const currentIds = new Set(localPolicies.map((p) => p.id))
      const removedIds = slaPolicies
        .filter((p) => !currentIds.has(p.id))
        .map((p) => p.id)
      if (removedIds.length > 0) {
        const { error: delError } = await supabase
          .from('sla_policies')
          .delete()
          .in('id', removedIds)
        if (delError) throw delError
      }

      await queryClient.invalidateQueries({
        queryKey: ['admin', 'slaPolicies'],
      })
      setLocalPolicies(null)
      toast.success('SLA policies saved')
    } catch (err) {
      console.error('Failed to save SLA policies:', err)
      toast.error('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    setLocalPolicies(null)
    setEditingId(null)
  }

  // ── Loading state ──────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm font-medium">Loading SLA policies...</p>
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Unsaved changes bar */}
      {hasChanges && (
        <div className="flex items-center justify-between px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <span className="flex items-center gap-2">
            <Settings className="w-4 h-4 flex-shrink-0" />
            You have unsaved changes.
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDiscard}>
              Discard
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              ) : (
                <Save className="w-3.5 h-3.5 mr-1.5" />
              )}
              Save Changes
            </Button>
          </div>
        </div>
      )}

      {/* Policy list */}
      <Card>
        <CardHeader className="border-b bg-gray-50/50">
          <div className="flex items-center justify-between">
            <CardTitle>SLA Policies</CardTitle>
            <span className="text-xs text-muted-foreground font-medium">
              {policies.filter((p) => p.enabled).length} of {policies.length}{' '}
              active &middot; First match wins
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-gray-100">
            {sortedPolicies.map((policy, idx) => {
              const isEditing = editingId === policy.id
              return (
                <div
                  key={policy.id}
                  className={`transition-colors ${!policy.enabled ? 'bg-gray-50/50' : ''}`}
                >
                  {/* Policy row */}
                  <div className="px-4 py-3.5 flex items-center gap-3">
                    <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />

                    <Switch
                      checked={policy.enabled}
                      onCheckedChange={() => toggleSla(policy.id)}
                      size="sm"
                    />

                    <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-medium truncate ${
                              policy.enabled
                                ? 'text-gray-900'
                                : 'text-gray-400'
                            }`}
                          >
                            {policy.name}
                          </span>
                          {policy.isDefault && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0"
                            >
                              Built-in
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                          <FileText className="w-3 h-3" />
                          <span className="truncate">
                            {getSlaSummary(policy)}
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-blue-500" />
                          <span>
                            <span className="font-medium text-gray-900">
                              {policy.metrics.firstReplyHours}h
                            </span>{' '}
                            first
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-purple-500" />
                          <span>
                            <span className="font-medium text-gray-900">
                              {policy.metrics.nextReplyHours}h
                            </span>{' '}
                            next
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                          <span>
                            <span className="font-medium text-gray-900">
                              {policy.metrics.warningThreshold ?? 75}%
                            </span>{' '}
                            warn
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => moveSla(policy.id, 'up')}
                        disabled={idx === 0}
                        title="Move up (higher priority)"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => moveSla(policy.id, 'down')}
                        disabled={idx === sortedPolicies.length - 1}
                        title="Move down (lower priority)"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant={isEditing ? 'secondary' : 'ghost'}
                        size="icon-xs"
                        onClick={() =>
                          setEditingId(isEditing ? null : policy.id)
                        }
                        title="Edit policy"
                      >
                        <Settings className="w-3.5 h-3.5" />
                      </Button>
                      {!policy.isDefault && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => deleteSla(policy.id)}
                          title="Delete policy"
                          className="text-gray-400 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Inline edit panel */}
                  {isEditing && (
                    <div className="px-4 pb-5 pt-2 ml-12 border-t border-gray-100 bg-gray-50/50">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 mt-2">
                        {/* Left column: Conditions */}
                        <div className="space-y-4">
                          <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-gray-400" />
                            Conditions
                          </h4>

                          <div>
                            <Label className="text-xs text-muted-foreground mb-1.5">
                              Policy Name
                            </Label>
                            <Input
                              value={policy.name}
                              onChange={(e) =>
                                updateSlaName(policy.id, e.target.value)
                              }
                            />
                          </div>

                          <div>
                            <Label className="text-xs text-muted-foreground mb-1.5">
                              Ticket Types
                            </Label>
                            <select
                              value={
                                policy.conditions.ticketTypes === 'any'
                                  ? 'any'
                                  : policy.conditions.ticketTypes[0]
                              }
                              onChange={(e) =>
                                updateSlaConditions(policy.id, {
                                  ...policy.conditions,
                                  ticketTypes:
                                    e.target.value === 'any'
                                      ? 'any'
                                      : [e.target.value as TicketType],
                                })
                              }
                              className="w-full h-8 px-2.5 text-sm border border-input rounded-lg bg-transparent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
                            >
                              <option value="any">Any Type</option>
                              {TICKET_TYPES.map((type) => (
                                <option key={type} value={type}>
                                  {type}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <Label className="text-xs text-muted-foreground mb-1.5">
                              Categories
                            </Label>
                            <select
                              value={
                                policy.conditions.categories === 'any'
                                  ? 'any'
                                  : policy.conditions.categories[0]
                              }
                              onChange={(e) =>
                                updateSlaConditions(policy.id, {
                                  ...policy.conditions,
                                  categories:
                                    e.target.value === 'any'
                                      ? 'any'
                                      : [e.target.value as TicketCategory],
                                })
                              }
                              className="w-full h-8 px-2.5 text-sm border border-input rounded-lg bg-transparent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
                            >
                              <option value="any">Any Category</option>
                              {TICKET_CATEGORIES.map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <Label className="text-xs text-muted-foreground mb-1.5">
                              Priorities
                            </Label>
                            <select
                              value={
                                policy.conditions.priorities === 'any'
                                  ? 'any'
                                  : policy.conditions.priorities[0]
                              }
                              onChange={(e) =>
                                updateSlaConditions(policy.id, {
                                  ...policy.conditions,
                                  priorities:
                                    e.target.value === 'any'
                                      ? 'any'
                                      : [e.target.value as TicketPriority],
                                })
                              }
                              className="w-full h-8 px-2.5 text-sm border border-input rounded-lg bg-transparent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
                            >
                              <option value="any">Any Priority</option>
                              {PRIORITIES.map((p) => (
                                <option key={p.value} value={p.value}>
                                  {p.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Right column: Metrics */}
                        <div className="space-y-4">
                          <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5 text-gray-400" />
                            Targets (Hours)
                          </h4>

                          <div>
                            <Label className="text-xs text-muted-foreground mb-1.5">
                              First Reply Target
                            </Label>
                            <div className="relative">
                              <Input
                                type="number"
                                min={1}
                                value={policy.metrics.firstReplyHours}
                                onChange={(e) =>
                                  updateSlaMetrics(policy.id, {
                                    ...policy.metrics,
                                    firstReplyHours:
                                      parseInt(e.target.value) || 1,
                                  })
                                }
                                className="pr-12"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                hrs
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1">
                              Time until first agent response
                            </p>
                          </div>

                          <div>
                            <Label className="text-xs text-muted-foreground mb-1.5">
                              Next Reply Target
                            </Label>
                            <div className="relative">
                              <Input
                                type="number"
                                min={1}
                                value={policy.metrics.nextReplyHours}
                                onChange={(e) =>
                                  updateSlaMetrics(policy.id, {
                                    ...policy.metrics,
                                    nextReplyHours:
                                      parseInt(e.target.value) || 1,
                                  })
                                }
                                className="pr-12"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                hrs
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1">
                              Time until next response after user replies
                            </p>
                          </div>

                          <div>
                            <Label className="text-xs text-muted-foreground mb-1.5">
                              Warning Threshold
                            </Label>
                            <div className="relative">
                              <Input
                                type="number"
                                min={1}
                                max={99}
                                value={policy.metrics.warningThreshold ?? 75}
                                onChange={(e) =>
                                  updateSlaMetrics(policy.id, {
                                    ...policy.metrics,
                                    warningThreshold: Math.min(
                                      99,
                                      Math.max(
                                        1,
                                        parseInt(e.target.value) || 75
                                      )
                                    ),
                                  })
                                }
                                className="pr-12"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                %
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1">
                              Flag as &ldquo;At Risk&rdquo; when this % of SLA
                              time has elapsed
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {sortedPolicies.length === 0 && (
              <div className="px-6 py-8 text-center text-sm text-muted-foreground">
                No SLA policies configured
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add new SLA policy */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogTrigger
          render={
            <Button
              variant="outline"
              className="w-full border-2 border-dashed"
            />
          }
        >
          <Plus className="w-4 h-4 mr-2" />
          Add SLA Policy
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New SLA Policy</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            {/* Conditions */}
            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wider">
                Conditions
              </h4>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5">
                  Policy Name
                </Label>
                <Input
                  value={newSlaName}
                  onChange={(e) => setNewSlaName(e.target.value)}
                  placeholder="e.g. VIP Client SLA"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5">
                  Ticket Type
                </Label>
                <select
                  value={
                    newSlaConditions.ticketTypes === 'any'
                      ? 'any'
                      : newSlaConditions.ticketTypes[0]
                  }
                  onChange={(e) =>
                    setNewSlaConditions({
                      ...newSlaConditions,
                      ticketTypes:
                        e.target.value === 'any'
                          ? 'any'
                          : [e.target.value as TicketType],
                    })
                  }
                  className="w-full h-8 px-2.5 text-sm border border-input rounded-lg bg-transparent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
                >
                  <option value="any">Any Type</option>
                  {TICKET_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5">
                  Category
                </Label>
                <select
                  value={
                    newSlaConditions.categories === 'any'
                      ? 'any'
                      : newSlaConditions.categories[0]
                  }
                  onChange={(e) =>
                    setNewSlaConditions({
                      ...newSlaConditions,
                      categories:
                        e.target.value === 'any'
                          ? 'any'
                          : [e.target.value as TicketCategory],
                    })
                  }
                  className="w-full h-8 px-2.5 text-sm border border-input rounded-lg bg-transparent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
                >
                  <option value="any">Any Category</option>
                  {TICKET_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5">
                  Priority
                </Label>
                <select
                  value={
                    newSlaConditions.priorities === 'any'
                      ? 'any'
                      : newSlaConditions.priorities[0]
                  }
                  onChange={(e) =>
                    setNewSlaConditions({
                      ...newSlaConditions,
                      priorities:
                        e.target.value === 'any'
                          ? 'any'
                          : [e.target.value as TicketPriority],
                    })
                  }
                  className="w-full h-8 px-2.5 text-sm border border-input rounded-lg bg-transparent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
                >
                  <option value="any">Any Priority</option>
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Metrics */}
            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wider">
                Targets
              </h4>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5">
                  First Reply (hours)
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={newSlaMetrics.firstReplyHours}
                  onChange={(e) =>
                    setNewSlaMetrics({
                      ...newSlaMetrics,
                      firstReplyHours: parseInt(e.target.value) || 1,
                    })
                  }
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5">
                  Next Reply (hours)
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={newSlaMetrics.nextReplyHours}
                  onChange={(e) =>
                    setNewSlaMetrics({
                      ...newSlaMetrics,
                      nextReplyHours: parseInt(e.target.value) || 1,
                    })
                  }
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5">
                  Warning Threshold (%)
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={99}
                  value={newSlaMetrics.warningThreshold ?? 75}
                  onChange={(e) =>
                    setNewSlaMetrics({
                      ...newSlaMetrics,
                      warningThreshold: Math.min(
                        99,
                        Math.max(1, parseInt(e.target.value) || 75)
                      ),
                    })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={addSla} disabled={!newSlaName.trim()}>
              <Plus className="w-4 h-4 mr-1.5" />
              Add Policy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
