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
import { useSlaPolicies, useDepartmentCategories } from '@/hooks/use-admin-config'
import { createClerkSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  SlaForm,
  buildSlaFormCatalog,
  type SlaFormValue,
} from '@/components/admin/sla/sla-form'
import { SlaFormWizard } from '@/components/admin/sla/sla-form-wizard'
import type { SlaPolicy, SlaPolicyMetrics } from '@/types/ticket'

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

function formatHoursOrOff(hours: number | null | undefined): string {
  return hours == null ? 'Off' : `${hours}h`
}

const EMPTY_FORM_VALUE: SlaFormValue = {
  name: '',
  conditions: {
    ticketTypes: 'any',
    categories: 'any',
    priorities: 'any',
  },
  metrics: {
    firstReplyHours: 4,
    nextReplyHours: 8,
    warningThreshold: 75,
  },
}

// ── Page component ─────────────────────────────────────────────

export default function SlaAdminPage() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const { data: slaPolicies = [], isLoading } = useSlaPolicies()
  const { data: departmentGroups = [] } = useDepartmentCategories()

  const catalog = useMemo(
    () => buildSlaFormCatalog(departmentGroups),
    [departmentGroups],
  )

  const [localPolicies, setLocalPolicies] = useState<SlaPolicy[] | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addForm, setAddForm] = useState<SlaFormValue>(EMPTY_FORM_VALUE)
  const [wizardMode, setWizardMode] = useState(false)

  const policies = localPolicies ?? slaPolicies
  const hasChanges = localPolicies !== null

  const sortedPolicies = useMemo(
    () => [...policies].sort((a, b) => a.sort_order - b.sort_order),
    [policies],
  )

  // ── Mutation helpers ───────────────────────────────────────

  const updatePolicies = useCallback(
    (updater: (prev: SlaPolicy[]) => SlaPolicy[]) => {
      setLocalPolicies((prev) => updater(prev ?? slaPolicies))
    },
    [slaPolicies],
  )

  const toggleSla = (id: string) =>
    updatePolicies((prev) =>
      prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p)),
    )

  const updatePolicyForm = (id: string, next: SlaFormValue) =>
    updatePolicies((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              name: next.name,
              conditions: next.conditions,
              metrics: next.metrics,
            }
          : p,
      ),
    )

  const moveSla = (id: string, direction: 'up' | 'down') => {
    updatePolicies((prev) => {
      const sorted = [...prev].sort((a, b) => a.sort_order - b.sort_order)
      const idx = sorted.findIndex((p) => p.id === id)
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1
      if (swapIdx < 0 || swapIdx >= sorted.length) return prev
      const current = sorted[idx]
      const swap = sorted[swapIdx]
      return prev.map((p) => {
        if (p.id === current.id) return { ...p, sort_order: swap.sort_order }
        if (p.id === swap.id) return { ...p, sort_order: current.sort_order }
        return p
      })
    })
  }

  const deleteSla = (id: string) => {
    const target = (localPolicies ?? slaPolicies).find((p) => p.id === id)
    const ok = window.confirm(
      `Delete SLA policy "${target?.name ?? id}"? This cannot be undone.`,
    )
    if (!ok) return
    updatePolicies((prev) => prev.filter((p) => p.id !== id))
    if (editingId === id) setEditingId(null)
  }

  const addSla = () => {
    if (!addForm.name.trim()) return
    const currentPolicies = localPolicies ?? slaPolicies
    const newPolicy: SlaPolicy = {
      id: `custom-sla-${Date.now()}`,
      name: addForm.name.trim(),
      enabled: true,
      conditions: addForm.conditions,
      metrics: addForm.metrics,
      sort_order: currentPolicies.length,
      is_default: false,
    }
    updatePolicies((prev) => [...prev, newPolicy])
    setAddForm(EMPTY_FORM_VALUE)
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
          sort_order: p.sort_order,
          is_default: p.is_default ?? false,
        })),
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
                              policy.enabled ? 'text-gray-900' : 'text-gray-400'
                            }`}
                          >
                            {policy.name}
                          </span>
                          {policy.is_default && (
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
                          <span className="truncate">{getSlaSummary(policy)}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-blue-500" />
                          <span>
                            <span
                              className={`font-medium ${policy.metrics.firstReplyHours == null ? 'text-gray-400' : 'text-gray-900'}`}
                            >
                              {formatHoursOrOff(policy.metrics.firstReplyHours)}
                            </span>{' '}
                            first
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-purple-500" />
                          <span>
                            <span
                              className={`font-medium ${policy.metrics.nextReplyHours == null ? 'text-gray-400' : 'text-gray-900'}`}
                            >
                              {formatHoursOrOff(policy.metrics.nextReplyHours)}
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
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => deleteSla(policy.id)}
                        title="Delete policy"
                        className="text-gray-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Inline edit panel */}
                  {isEditing && (
                    <div className="px-4 pb-5 pt-3 ml-12 border-t border-gray-100 bg-gray-50/50">
                      <div className="mb-3">
                        <Label className="mb-1.5 text-xs text-muted-foreground">
                          Rule name
                        </Label>
                        <Input
                          value={policy.name}
                          onChange={(e) =>
                            updatePolicyForm(policy.id, {
                              name: e.target.value,
                              conditions: policy.conditions,
                              metrics: policy.metrics,
                            })
                          }
                        />
                      </div>
                      <SlaForm
                        value={{
                          name: policy.name,
                          conditions: policy.conditions,
                          metrics: policy.metrics,
                        }}
                        onChange={(next) => updatePolicyForm(policy.id, next)}
                        catalog={catalog}
                        hideName
                        allPolicies={policies}
                        currentRuleId={policy.id}
                      />
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
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between gap-3">
              <DialogTitle>New SLA Policy</DialogTitle>
              <label className="flex cursor-pointer items-center gap-2 text-xs font-normal text-muted-foreground">
                Walk me through it
                <Switch
                  checked={wizardMode}
                  onCheckedChange={setWizardMode}
                  size="sm"
                />
              </label>
            </div>
          </DialogHeader>
          {wizardMode ? (
            <SlaFormWizard
              value={addForm}
              onChange={setAddForm}
              catalog={catalog}
              allPolicies={policies}
              currentRuleId={null}
              onComplete={addSla}
              onCancel={() => setShowAddDialog(false)}
            />
          ) : (
            <>
              <SlaForm
                value={addForm}
                onChange={setAddForm}
                catalog={catalog}
                allPolicies={policies}
                currentRuleId={null}
              />
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowAddDialog(false)}
                >
                  Cancel
                </Button>
                <Button onClick={addSla} disabled={!addForm.name.trim()}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add Policy
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// formatHoursOrOff is used in the list rendering above
void formatHoursOrOff
