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
  X,
  GripVertical,
  Settings,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useViewConfigs } from '@/hooks/use-admin-config'
import { createClerkSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import type {
  ViewConfig,
  ViewFilterConfig,
  TicketStatus,
  TicketCategory,
} from '@/types'

// ── Filter option constants ────────────────────────────────────

const STATUS_OPTIONS: { value: TicketStatus | 'any'; label: string }[] = [
  { value: 'any', label: 'Any Status' },
  { value: 'new', label: 'New' },
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Pending' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'solved', label: 'Solved' },
]

const ASSIGNEE_OPTIONS: {
  value: ViewFilterConfig['assigneeFilter']
  label: string
}[] = [
  { value: 'any', label: 'Anyone' },
  { value: 'me', label: 'Assigned to Me' },
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'assigned', label: 'Any Assigned Agent' },
]

const CATEGORY_OPTIONS: { value: TicketCategory | 'any'; label: string }[] = [
  { value: 'any', label: 'Any Category' },
  { value: 'Loan Origination', label: 'Loan Origination' },
  { value: 'Underwriting', label: 'Underwriting' },
  { value: 'Closing', label: 'Closing' },
  { value: 'Servicing', label: 'Servicing' },
  { value: 'Compliance', label: 'Compliance' },
  { value: 'IT Systems', label: 'IT Systems' },
  { value: 'General', label: 'General' },
]

const SLA_OPTIONS: { value: ViewFilterConfig['slaFilter']; label: string }[] = [
  { value: 'any', label: 'Any SLA Status' },
  { value: 'at-risk', label: 'SLA At Risk' },
  { value: 'breached', label: 'SLA Breached Only' },
]

const VIEW_GROUPS = [
  'Global',
  'My Queue',
  'By Status',
  'Loan Origination',
  'Underwriting',
  'Closing',
  'Servicing',
  'Compliance',
  'IT Systems',
  'General',
]

// ── Helpers ────────────────────────────────────────────────────

function getFilterSummary(config: ViewFilterConfig): string {
  const parts: string[] = []
  if (config.statusFilter !== 'any') {
    parts.push(
      STATUS_OPTIONS.find((o) => o.value === config.statusFilter)?.label ??
        config.statusFilter
    )
  }
  if (config.assigneeFilter !== 'any') {
    parts.push(
      ASSIGNEE_OPTIONS.find((o) => o.value === config.assigneeFilter)?.label ??
        config.assigneeFilter
    )
  }
  if (config.categoryFilter !== 'any') {
    parts.push(config.categoryFilter)
  }
  if (config.slaFilter === 'breached') {
    parts.push('SLA Breached')
  } else if (config.slaFilter === 'at-risk') {
    parts.push('SLA At Risk')
  }
  return parts.length > 0 ? parts.join(' · ') : 'All tickets'
}

// ── Page component ─────────────────────────────────────────────

export default function ViewsAdminPage() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const { data: viewConfigs = [], isLoading } = useViewConfigs()

  const [localConfigs, setLocalConfigs] = useState<ViewConfig[] | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [saving, setSaving] = useState(false)

  // New view form state
  const [newViewName, setNewViewName] = useState('')
  const [newViewGroup, setNewViewGroup] = useState(VIEW_GROUPS[0])
  const [newViewFilter, setNewViewFilter] = useState<ViewFilterConfig>({
    statusFilter: 'any',
    assigneeFilter: 'any',
    categoryFilter: 'any',
    slaFilter: 'any',
  })

  // Use local state if user has made edits, otherwise server data
  const configs = localConfigs ?? viewConfigs

  const hasChanges = localConfigs !== null

  const groupedConfigs = useMemo(() => {
    const groups = new Map<string, ViewConfig[]>()
    for (const g of VIEW_GROUPS) {
      groups.set(g, [])
    }
    for (const v of configs) {
      const groupName = v.group_name ?? 'Other'
      const arr = groups.get(groupName)
      if (arr) {
        arr.push(v)
      } else {
        groups.set(groupName, [v])
      }
    }
    // Sort each group by order
    for (const [, arr] of groups) {
      arr.sort((a, b) => a.sort_order - b.sort_order)
    }
    return Array.from(groups.entries())
      .filter(([, views]) => views.length > 0)
      .map(([name, views]) => ({ name, views }))
  }, [configs])

  // ── Mutation helpers ───────────────────────────────────────

  const updateConfigs = useCallback(
    (updater: (prev: ViewConfig[]) => ViewConfig[]) => {
      setLocalConfigs((prev) => updater(prev ?? viewConfigs))
    },
    [viewConfigs]
  )

  const toggleView = (id: string) => {
    updateConfigs((prev) =>
      prev.map((v) => (v.id === id ? { ...v, enabled: !v.enabled } : v))
    )
  }

  const updateViewName = (id: string, name: string) => {
    updateConfigs((prev) =>
      prev.map((v) => (v.id === id ? { ...v, name } : v))
    )
  }

  const updateViewFilter = (id: string, filter_config: ViewFilterConfig) => {
    updateConfigs((prev) =>
      prev.map((v) => (v.id === id ? { ...v, filter_config } : v))
    )
  }

  const moveView = (id: string, direction: 'up' | 'down') => {
    updateConfigs((prev) => {
      const view = prev.find((v) => v.id === id)
      if (!view) return prev
      const groupViews = prev
        .filter((v) => v.group_name === view.group_name)
        .sort((a, b) => a.sort_order - b.sort_order)
      const idx = groupViews.findIndex((v) => v.id === id)
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1
      if (swapIdx < 0 || swapIdx >= groupViews.length) return prev
      const swapView = groupViews[swapIdx]
      return prev.map((v) => {
        if (v.id === id) return { ...v, sort_order: swapView.sort_order }
        if (v.id === swapView.id) return { ...v, sort_order: view.sort_order }
        return v
      })
    })
  }

  const deleteView = (id: string) => {
    updateConfigs((prev) => prev.filter((v) => v.id !== id))
    if (editingId === id) setEditingId(null)
  }

  const addView = () => {
    if (!newViewName.trim()) return
    const currentConfigs = localConfigs ?? viewConfigs
    const groupViews = currentConfigs.filter((v) => v.group_name === newViewGroup)
    const newConfig: ViewConfig = {
      id: `custom-${Date.now()}`,
      name: newViewName.trim(),
      enabled: true,
      group_name: newViewGroup,
      filter_config: { ...newViewFilter },
      sort_order: groupViews.length,
      is_custom: true,
    }
    updateConfigs((prev) => [...prev, newConfig])
    setNewViewName('')
    setNewViewFilter({
      statusFilter: 'any',
      assigneeFilter: 'any',
      categoryFilter: 'any',
      slaFilter: 'any',
    })
    setShowAddDialog(false)
  }

  const handleSave = async () => {
    if (!localConfigs) return
    setSaving(true)
    try {
      const token = await getToken({ template: 'supabase' })
      if (!token) throw new Error('No auth token')
      const supabase = createClerkSupabaseClient(token)

      // Upsert all configs
      const { error } = await supabase
        .from('view_configs')
        .upsert(
          localConfigs.map((v) => ({
            id: v.id,
            name: v.name,
            enabled: v.enabled,
            group_name: v.group_name,
            filter_config: v.filter_config,
            sort_order: v.sort_order,
            is_custom: v.is_custom ?? false,
          }))
        )
      if (error) throw error

      // Delete any configs that were removed
      const currentIds = new Set(localConfigs.map((v) => v.id))
      const removedIds = viewConfigs
        .filter((v) => !currentIds.has(v.id))
        .map((v) => v.id)
      if (removedIds.length > 0) {
        const { error: delError } = await supabase
          .from('view_configs')
          .delete()
          .in('id', removedIds)
        if (delError) throw delError
      }

      await queryClient.invalidateQueries({ queryKey: ['admin', 'viewConfigs'] })
      setLocalConfigs(null)
      toast.success('View configurations saved')
    } catch (err) {
      console.error('Failed to save view configs:', err)
      toast.error('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    setLocalConfigs(null)
    setEditingId(null)
  }

  // ── Loading state ──────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm font-medium">Loading view configs...</p>
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

      {/* View groups */}
      {groupedConfigs.map((group) => (
        <Card key={group.name}>
          <CardHeader className="border-b bg-gray-50/50">
            <div className="flex items-center justify-between">
              <CardTitle>{group.name}</CardTitle>
              <span className="text-xs text-muted-foreground font-medium">
                {group.views.filter((v) => v.enabled).length} of{' '}
                {group.views.length} active
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              {group.views.map((view, idx) => {
                const isEditing = editingId === view.id
                return (
                  <div
                    key={view.id}
                    className={`transition-colors ${!view.enabled ? 'bg-gray-50/50' : ''}`}
                  >
                    {/* View row */}
                    <div className="px-4 py-3 flex items-center gap-3">
                      <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />

                      <Switch
                        checked={view.enabled}
                        onCheckedChange={() => toggleView(view.id)}
                        size="sm"
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-medium truncate ${
                              view.enabled
                                ? 'text-gray-900'
                                : 'text-gray-400'
                            }`}
                          >
                            {view.name}
                          </span>
                          {view.is_custom && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0"
                            >
                              Custom
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {getFilterSummary(view.filter_config)}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => moveView(view.id, 'up')}
                          disabled={idx === 0}
                          title="Move up"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => moveView(view.id, 'down')}
                          disabled={idx === group.views.length - 1}
                          title="Move down"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant={isEditing ? 'secondary' : 'ghost'}
                          size="icon-xs"
                          onClick={() =>
                            setEditingId(isEditing ? null : view.id)
                          }
                          title="Edit filters"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </Button>
                        {view.is_custom && (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => deleteView(view.id)}
                            title="Delete view"
                            className="text-gray-400 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Inline edit panel */}
                    {isEditing && (
                      <div className="px-4 pb-4 pt-2 ml-12 border-t border-gray-100 bg-gray-50/50">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                          <div>
                            <Label className="text-xs uppercase text-muted-foreground mb-1.5">
                              View Name
                            </Label>
                            <Input
                              value={view.name}
                              onChange={(e) =>
                                updateViewName(view.id, e.target.value)
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-xs uppercase text-muted-foreground mb-1.5">
                              Status Filter
                            </Label>
                            <select
                              value={view.filter_config.statusFilter}
                              onChange={(e) =>
                                updateViewFilter(view.id, {
                                  ...view.filter_config,
                                  statusFilter: e.target.value as
                                    | TicketStatus
                                    | 'any',
                                })
                              }
                              className="w-full h-8 px-2.5 text-sm border border-input rounded-lg bg-transparent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
                            >
                              {STATUS_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <Label className="text-xs uppercase text-muted-foreground mb-1.5">
                              Assignee Filter
                            </Label>
                            <select
                              value={view.filter_config.assigneeFilter}
                              onChange={(e) =>
                                updateViewFilter(view.id, {
                                  ...view.filter_config,
                                  assigneeFilter: e.target
                                    .value as ViewFilterConfig['assigneeFilter'],
                                })
                              }
                              className="w-full h-8 px-2.5 text-sm border border-input rounded-lg bg-transparent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
                            >
                              {ASSIGNEE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <Label className="text-xs uppercase text-muted-foreground mb-1.5">
                              Category Filter
                            </Label>
                            <select
                              value={view.filter_config.categoryFilter}
                              onChange={(e) =>
                                updateViewFilter(view.id, {
                                  ...view.filter_config,
                                  categoryFilter: e.target.value as
                                    | TicketCategory
                                    | 'any',
                                })
                              }
                              className="w-full h-8 px-2.5 text-sm border border-input rounded-lg bg-transparent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
                            >
                              {CATEGORY_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <Label className="text-xs uppercase text-muted-foreground mb-1.5">
                              SLA Filter
                            </Label>
                            <select
                              value={view.filter_config.slaFilter}
                              onChange={(e) =>
                                updateViewFilter(view.id, {
                                  ...view.filter_config,
                                  slaFilter: e.target
                                    .value as ViewFilterConfig['slaFilter'],
                                })
                              }
                              className="w-full h-8 px-2.5 text-sm border border-input rounded-lg bg-transparent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
                            >
                              {SLA_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {group.views.length === 0 && (
                <div className="px-6 py-8 text-center text-sm text-muted-foreground">
                  No views in this group
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Add new view */}
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
          Add Custom View
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Custom View</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs uppercase text-muted-foreground mb-1.5">
                View Name
              </Label>
              <Input
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                placeholder="e.g. High Priority Unassigned"
              />
            </div>
            <div>
              <Label className="text-xs uppercase text-muted-foreground mb-1.5">
                Group
              </Label>
              <select
                value={newViewGroup}
                onChange={(e) => setNewViewGroup(e.target.value)}
                className="w-full h-8 px-2.5 text-sm border border-input rounded-lg bg-transparent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
              >
                {VIEW_GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs uppercase text-muted-foreground mb-1.5">
                Status Filter
              </Label>
              <select
                value={newViewFilter.statusFilter}
                onChange={(e) =>
                  setNewViewFilter({
                    ...newViewFilter,
                    statusFilter: e.target.value as TicketStatus | 'any',
                  })
                }
                className="w-full h-8 px-2.5 text-sm border border-input rounded-lg bg-transparent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs uppercase text-muted-foreground mb-1.5">
                Assignee Filter
              </Label>
              <select
                value={newViewFilter.assigneeFilter}
                onChange={(e) =>
                  setNewViewFilter({
                    ...newViewFilter,
                    assigneeFilter: e.target
                      .value as ViewFilterConfig['assigneeFilter'],
                  })
                }
                className="w-full h-8 px-2.5 text-sm border border-input rounded-lg bg-transparent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
              >
                {ASSIGNEE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs uppercase text-muted-foreground mb-1.5">
                Category Filter
              </Label>
              <select
                value={newViewFilter.categoryFilter}
                onChange={(e) =>
                  setNewViewFilter({
                    ...newViewFilter,
                    categoryFilter: e.target.value as TicketCategory | 'any',
                  })
                }
                className="w-full h-8 px-2.5 text-sm border border-input rounded-lg bg-transparent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs uppercase text-muted-foreground mb-1.5">
                SLA Filter
              </Label>
              <select
                value={newViewFilter.slaFilter}
                onChange={(e) =>
                  setNewViewFilter({
                    ...newViewFilter,
                    slaFilter: e.target
                      .value as ViewFilterConfig['slaFilter'],
                  })
                }
                className="w-full h-8 px-2.5 text-sm border border-input rounded-lg bg-transparent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
              >
                {SLA_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={addView} disabled={!newViewName.trim()}>
              <Plus className="w-4 h-4 mr-1.5" />
              Add View
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
