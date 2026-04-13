'use client'

import { useState, useMemo } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Loader2,
  Plus,
  Search,
  Trash2,
  Pencil,
  MessageSquare,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClerkSupabaseClient } from '@/lib/supabase/client'
import { useCannedResponses, useTeams } from '@/hooks/use-admin-config'
import type {
  CannedResponse,
  CannedResponseAction,
  TicketStatus,
  TicketPriority,
} from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ── Constants ──────────────────────────────────────────────────

const STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Pending' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'solved', label: 'Solved' },
]

const PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

type FormState = Omit<CannedResponse, 'id'> & { id?: string }

const emptyForm: FormState = {
  name: '',
  content: '',
  category: '',
  actions: {},
  isPersonal: false,
  usageCount: 0,
}

// ── Page Component ─────────────────────────────────────────────

export default function CannedResponsesPage() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const { data: responses = [], isLoading } = useCannedResponses()
  const { data: teams = [] } = useTeams()

  const [searchQuery, setSearchQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // ── Filtered list ──────────────────────────────────────────

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return responses
    const q = searchQuery.toLowerCase()
    return responses.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.category ?? '').toLowerCase().includes(q),
    )
  }, [responses, searchQuery])

  // ── Mutations ──────────────────────────────────────────────

  const upsertMutation = useMutation({
    mutationFn: async (data: FormState) => {
      const token = await getToken({ template: 'supabase' })
      if (!token) throw new Error('No auth token')
      const supabase = createClerkSupabaseClient(token)

      const payload = {
        name: data.name,
        content: data.content,
        category: data.category || null,
        actions: data.actions && Object.keys(data.actions).length > 0 ? data.actions : null,
        is_personal: data.isPersonal ?? false,
        usage_count: data.usageCount ?? 0,
      }

      if (data.id) {
        const { error } = await supabase
          .from('canned_responses')
          .update(payload)
          .eq('id', data.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('canned_responses')
          .insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'cannedResponses'] })
      setDialogOpen(false)
      toast.success(form.id ? 'Response updated' : 'Response created')
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
        .from('canned_responses')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'cannedResponses'] })
      setDeleteDialogOpen(false)
      setDeletingId(null)
      toast.success('Response deleted')
    },
    onError: (err: Error) => {
      toast.error(`Failed to delete: ${err.message}`)
    },
  })

  // ── Helpers ────────────────────────────────────────────────

  function openCreate() {
    setForm({ ...emptyForm })
    setDialogOpen(true)
  }

  function openEdit(r: CannedResponse) {
    setForm({
      id: r.id,
      name: r.name,
      content: r.content,
      category: r.category ?? '',
      actions: r.actions ?? {},
      isPersonal: r.isPersonal ?? false,
      createdBy: r.createdBy,
      usageCount: r.usageCount ?? 0,
    })
    setDialogOpen(true)
  }

  function confirmDelete(id: string) {
    setDeletingId(id)
    setDeleteDialogOpen(true)
  }

  function updateAction<K extends keyof CannedResponseAction>(
    key: K,
    value: CannedResponseAction[K] | undefined,
  ) {
    setForm((prev) => {
      const actions = { ...prev.actions }
      if (value === undefined || value === '' || value === null) {
        delete (actions as Record<string, unknown>)[key]
      } else {
        ;(actions as Record<string, unknown>)[key] = value
      }
      return { ...prev, actions }
    })
  }

  // ── Loading state ──────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm font-medium">Loading canned responses...</p>
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
          <h1 className="text-2xl font-bold text-gray-900">
            Canned Responses
          </h1>
          <p className="text-gray-500 mt-1">
            Pre-written reply templates with optional automated actions
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1.5" data-icon="inline-start" />
          Add Response
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name or category..."
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <MessageSquare className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">
                {searchQuery ? 'No matching responses' : 'No canned responses yet'}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {searchQuery
                  ? 'Try a different search term.'
                  : 'Create your first template to get started.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Name</TableHead>
                  <TableHead className="w-[120px]">Category</TableHead>
                  <TableHead>Content Preview</TableHead>
                  <TableHead className="w-[80px] text-center">Uses</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                  <TableHead className="w-[100px] text-right">
                    &nbsp;
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {r.name}
                        {r.isPersonal && (
                          <Badge variant="secondary" className="text-[10px]">
                            Personal
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {r.category ? (
                        <Badge variant="outline">{r.category}</Badge>
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="truncate text-muted-foreground">
                        {r.content}
                      </p>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {r.usageCount ?? 0}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {r.actions?.setStatus && (
                          <Badge variant="secondary" className="text-[10px]">
                            Status: {r.actions.setStatus}
                          </Badge>
                        )}
                        {r.actions?.setPriority && (
                          <Badge variant="secondary" className="text-[10px]">
                            Priority: {r.actions.setPriority}
                          </Badge>
                        )}
                        {r.actions?.setTeam && (
                          <Badge variant="secondary" className="text-[10px]">
                            Team
                          </Badge>
                        )}
                        {r.actions?.addInternalNote && (
                          <Badge variant="secondary" className="text-[10px]">
                            Note
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEdit(r)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => confirmDelete(r.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Create / Edit Dialog ──────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {form.id ? 'Edit Canned Response' : 'New Canned Response'}
            </DialogTitle>
            <DialogDescription>
              {form.id
                ? 'Update the response template and its automated actions.'
                : 'Create a reusable reply template.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Name */}
            <div className="grid gap-1.5">
              <Label htmlFor="cr-name">Name</Label>
              <Input
                id="cr-name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g. Acknowledge Receipt"
              />
            </div>

            {/* Category */}
            <div className="grid gap-1.5">
              <Label htmlFor="cr-category">Category</Label>
              <Input
                id="cr-category"
                value={form.category ?? ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value }))
                }
                placeholder="e.g. General, Closing, IT"
              />
            </div>

            {/* Content */}
            <div className="grid gap-1.5">
              <Label htmlFor="cr-content">Content</Label>
              <Textarea
                id="cr-content"
                value={form.content}
                onChange={(e) =>
                  setForm((f) => ({ ...f, content: e.target.value }))
                }
                placeholder="Type the response content..."
                rows={5}
              />
              <p className="text-xs text-muted-foreground">
                Template variables:{' '}
                <code className="bg-muted px-1 rounded">{'{{ticket_id}}'}</code>{' '}
                <code className="bg-muted px-1 rounded">{'{{agent_name}}'}</code>{' '}
                <code className="bg-muted px-1 rounded">
                  {'{{requester_name}}'}
                </code>
              </p>
            </div>

            {/* ── Actions section ─────────────────────────────── */}
            <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
              <h4 className="text-sm font-medium">
                Automated Actions (optional)
              </h4>

              {/* Set Status */}
              <div className="grid gap-1.5">
                <Label>Set Status</Label>
                <Select
                  value={form.actions?.setStatus ?? ''}
                  onValueChange={(val) =>
                    updateAction(
                      'setStatus',
                      !val || val === '__none__'
                        ? undefined
                        : (val as TicketStatus),
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="No change" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No change</SelectItem>
                    {STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Set Priority */}
              <div className="grid gap-1.5">
                <Label>Set Priority</Label>
                <Select
                  value={form.actions?.setPriority ?? ''}
                  onValueChange={(val) =>
                    updateAction(
                      'setPriority',
                      !val || val === '__none__'
                        ? undefined
                        : (val as TicketPriority),
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="No change" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No change</SelectItem>
                    {PRIORITY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Set Team */}
              <div className="grid gap-1.5">
                <Label>Set Team</Label>
                <Select
                  value={form.actions?.setTeam ?? ''}
                  onValueChange={(val) =>
                    updateAction(
                      'setTeam',
                      !val || val === '__none__' ? undefined : val,
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="No change" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No change</SelectItem>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Internal Note */}
              <div className="grid gap-1.5">
                <Label>Add Internal Note</Label>
                <Textarea
                  value={form.actions?.addInternalNote ?? ''}
                  onChange={(e) =>
                    updateAction(
                      'addInternalNote',
                      e.target.value || undefined,
                    )
                  }
                  placeholder="Optional internal note added when response is used..."
                  rows={2}
                />
              </div>
            </div>

            {/* Personal toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Personal Response</p>
                <p className="text-xs text-muted-foreground">
                  Visible only to you
                </p>
              </div>
              <Switch
                checked={form.isPersonal ?? false}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, isPersonal: checked }))
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
              disabled={
                !form.name.trim() ||
                !form.content.trim() ||
                upsertMutation.isPending
              }
            >
              {upsertMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              )}
              {form.id ? 'Save Changes' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ────────────────────────── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Response</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this canned response? This action
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
