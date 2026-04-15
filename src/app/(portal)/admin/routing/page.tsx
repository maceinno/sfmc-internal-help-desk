'use client'

import { useState, useMemo } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Loader2,
  Plus,
  Trash2,
  Pencil,
  ArrowUp,
  ArrowDown,
  Route,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClerkSupabaseClient } from '@/lib/supabase/client'
import { useRoutingRules, useTeams } from '@/hooks/use-admin-config'
import type { RoutingRule, TicketCategory, User } from '@/types'
import { TICKET_TYPES } from '@/data/ticket-config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ── Constants ──────────────────────────────────────────────────

const CATEGORY_OPTIONS: string[] = [
  'Loan Origination',
  'Underwriting',
  'Closing',
  'Servicing',
  'Compliance',
  'IT Systems',
  'General',
]

// ── Types ──────────────────────────────────────────────────────

interface RuleFormState {
  id?: string
  name: string
  enabled: boolean
  ticketType: string
  category: string
  assignToUserId: string
  assignToTeam: string
  priority: number
}

const emptyForm: RuleFormState = {
  name: '',
  enabled: true,
  ticketType: 'any',
  category: 'any',
  assignToUserId: '',
  assignToTeam: '',
  priority: 10,
}

// ── Hook: Fetch agent-level users for autocomplete ─────────────

function useAgentUsers() {
  const { getToken } = useAuth()

  return useQuery<User[]>({
    queryKey: ['admin', 'agentUsers'],
    queryFn: async () => {
      const token = await getToken({ template: 'supabase' })
      if (!token) throw new Error('No auth token')
      const supabase = createClerkSupabaseClient(token)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['agent', 'admin'])
        .order('name', { ascending: true })
      if (error) throw error
      return data as User[]
    },
  })
}

// ── Page Component ─────────────────────────────────────────────

export default function RoutingPage() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const { data: rules = [], isLoading } = useRoutingRules()
  const { data: teams = [] } = useTeams()
  const { data: agentUsers = [] } = useAgentUsers()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [form, setForm] = useState<RuleFormState>(emptyForm)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Sorted rules
  const sorted = useMemo(
    () => [...rules].sort((a, b) => a.priority_order - b.priority_order),
    [rules],
  )

  // ── Mutations ──────────────────────────────────────────────

  const upsertMutation = useMutation({
    mutationFn: async (data: RuleFormState) => {
      const token = await getToken({ template: 'supabase' })
      if (!token) throw new Error('No auth token')
      const supabase = createClerkSupabaseClient(token)

      const payload = {
        name: data.name,
        enabled: data.enabled,
        ticket_type: data.ticketType,
        category: data.category,
        assign_to_user: data.assignToUserId || null,
        assign_to_team: data.assignToTeam || null,
        priority_order: data.priority,
      }

      if (data.id) {
        const { error } = await supabase
          .from('routing_rules')
          .update(payload)
          .eq('id', data.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('routing_rules')
          .insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'routingRules'] })
      setDialogOpen(false)
      toast.success(form.id ? 'Rule updated' : 'Rule created')
    },
    onError: (err: Error) => {
      toast.error(`Failed to save: ${err.message}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken({ template: 'supabase' })
      if (!token) throw new Error('No auth token')
      const supabase = createClerkSupabaseClient(token)
      const { error } = await supabase
        .from('routing_rules')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'routingRules'] })
      setDeleteDialogOpen(false)
      setDeletingId(null)
      toast.success('Rule deleted')
    },
    onError: (err: Error) => {
      toast.error(`Failed to delete: ${err.message}`)
    },
  })

  const toggleMutation = useMutation({
    mutationFn: async ({
      id,
      enabled,
    }: {
      id: string
      enabled: boolean
    }) => {
      const token = await getToken({ template: 'supabase' })
      if (!token) throw new Error('No auth token')
      const supabase = createClerkSupabaseClient(token)
      const { error } = await supabase
        .from('routing_rules')
        .update({ enabled })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'routingRules'] })
    },
    onError: (err: Error) => {
      toast.error(`Failed to toggle: ${err.message}`)
    },
  })

  const reorderMutation = useMutation({
    mutationFn: async ({
      id,
      newPriority,
    }: {
      id: string
      newPriority: number
    }) => {
      const token = await getToken({ template: 'supabase' })
      if (!token) throw new Error('No auth token')
      const supabase = createClerkSupabaseClient(token)
      const { error } = await supabase
        .from('routing_rules')
        .update({ priority_order: newPriority })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'routingRules'] })
    },
    onError: (err: Error) => {
      toast.error(`Failed to reorder: ${err.message}`)
    },
  })

  // ── Helpers ────────────────────────────────────────────────

  function openCreate() {
    setForm({ ...emptyForm })
    setDialogOpen(true)
  }

  function openEdit(r: RoutingRule) {
    setForm({
      id: r.id,
      name: r.name,
      enabled: r.enabled,
      ticketType: r.ticket_type,
      category: r.category,
      assignToUserId: r.assign_to_user ?? '',
      assignToTeam: r.assign_to_team ?? '',
      priority: r.priority_order,
    })
    setDialogOpen(true)
  }

  function confirmDelete(id: string) {
    setDeletingId(id)
    setDeleteDialogOpen(true)
  }

  function moveUp(rule: RoutingRule, index: number) {
    if (index === 0) return
    const above = sorted[index - 1]
    // Swap priorities
    reorderMutation.mutate({ id: rule.id, newPriority: above.priority_order })
    reorderMutation.mutate({ id: above.id, newPriority: rule.priority_order })
  }

  function moveDown(rule: RoutingRule, index: number) {
    if (index >= sorted.length - 1) return
    const below = sorted[index + 1]
    reorderMutation.mutate({ id: rule.id, newPriority: below.priority_order })
    reorderMutation.mutate({ id: below.id, newPriority: rule.priority_order })
  }

  function getTeamName(id: string) {
    return teams.find((t) => t.id === id)?.name ?? id
  }

  function getUserName(id: string) {
    return agentUsers.find((u) => u.id === id)?.name ?? id
  }

  function getAssignmentLabel(rule: RoutingRule) {
    if (rule.assign_to_user) return getUserName(rule.assign_to_user)
    if (rule.assign_to_team) return getTeamName(rule.assign_to_team)
    return 'Unassigned'
  }

  // ── Loading state ──────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm font-medium">Loading routing rules...</p>
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Routing Rules</h1>
          <p className="text-gray-500 mt-1">
            Automatically assign incoming tickets to teams or users. Rules are
            evaluated in priority order (lower number = higher priority).
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1.5" data-icon="inline-start" />
          Add Rule
        </Button>
      </div>

      {/* Rules list */}
      {sorted.length === 0 ? (
        <Card>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Route className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">
                No routing rules found
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Add rules to automatically assign incoming tickets.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sorted.map((rule, index) => (
            <Card key={rule.id} size="sm">
              <CardContent>
                <div className="flex items-center gap-4">
                  {/* Reorder */}
                  <div className="flex flex-col gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      disabled={index === 0}
                      onClick={() => moveUp(rule, index)}
                    >
                      <ArrowUp className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      disabled={index >= sorted.length - 1}
                      onClick={() => moveDown(rule, index)}
                    >
                      <ArrowDown className="w-3 h-3" />
                    </Button>
                  </div>

                  {/* Enabled toggle */}
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={(checked) =>
                      toggleMutation.mutate({
                        id: rule.id,
                        enabled: checked,
                      })
                    }
                  />

                  {/* Rule info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-medium ${!rule.enabled ? 'text-muted-foreground line-through' : ''}`}
                      >
                        {rule.name}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        #{rule.priority_order}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                      <span>If</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {rule.ticket_type === 'any'
                          ? 'Any Type'
                          : rule.ticket_type}
                      </Badge>
                      <span>+</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {rule.category === 'any'
                          ? 'Any Category'
                          : rule.category}
                      </Badge>
                      <span className="mx-1">then assign to</span>
                      <Badge
                        variant="default"
                        className="text-[10px]"
                      >
                        {getAssignmentLabel(rule)}
                      </Badge>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEdit(rule)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => confirmDelete(rule.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Create / Edit Dialog ──────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {form.id ? 'Edit Routing Rule' : 'New Routing Rule'}
            </DialogTitle>
            <DialogDescription>
              {form.id
                ? 'Update the conditions and assignment for this rule.'
                : 'Define conditions to auto-assign matching tickets.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Name */}
            <div className="grid gap-1.5">
              <Label htmlFor="rr-name">Rule Name</Label>
              <Input
                id="rr-name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g. Route IT tickets to IT Team"
              />
            </div>

            {/* Enabled */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <p className="text-sm font-medium">Enabled</p>
              <Switch
                checked={form.enabled}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, enabled: checked }))
                }
              />
            </div>

            {/* Ticket Type */}
            <div className="grid gap-1.5">
              <Label>Ticket Type</Label>
              <Select
                value={form.ticketType}
                onValueChange={(val) =>
                  setForm((f) => ({ ...f, ticketType: val ?? 'any' }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any Type</SelectItem>
                  {TICKET_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category */}
            <div className="grid gap-1.5">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(val) =>
                  setForm((f) => ({ ...f, category: val ?? 'any' }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any Category</SelectItem>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Assign to User */}
            <div className="grid gap-1.5">
              <Label>Assign to User</Label>
              <Select
                value={form.assignToUserId || '__none__'}
                onValueChange={(val) =>
                  setForm((f) => ({
                    ...f,
                    assignToUserId: !val || val === '__none__' ? '' : val,
                    assignToTeam: val && val !== '__none__' ? '' : f.assignToTeam,
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {agentUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Assign to Team */}
            <div className="grid gap-1.5">
              <Label>Assign to Team</Label>
              <Select
                value={form.assignToTeam || '__none__'}
                onValueChange={(val) =>
                  setForm((f) => ({
                    ...f,
                    assignToTeam: !val || val === '__none__' ? '' : val,
                    assignToUserId:
                      val && val !== '__none__' ? '' : f.assignToUserId,
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Setting a user clears the team, and vice versa.
              </p>
            </div>

            {/* Priority */}
            <div className="grid gap-1.5">
              <Label htmlFor="rr-priority">
                Priority Order (lower = evaluated first)
              </Label>
              <Input
                id="rr-priority"
                type="number"
                min={1}
                value={form.priority}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    priority: parseInt(e.target.value) || 1,
                  }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={upsertMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => upsertMutation.mutate(form)}
              disabled={!form.name.trim() || upsertMutation.isPending}
            >
              {upsertMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              )}
              {form.id ? 'Save Changes' : 'Create Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ────────────────────────── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Rule</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this routing rule? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
