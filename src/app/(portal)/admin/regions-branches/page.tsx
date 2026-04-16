'use client'

import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Trash2,
  Pencil,
  MapPin,
  Building2,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClerkSupabaseClient } from '@/lib/supabase/client'
import { useBranches, useRegions } from '@/hooks/use-admin-config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

// ── Page ────────────────────────────────────────────────────────

export default function RegionsBranchesPage() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const { data: regions = [], isLoading: regionsLoading } = useRegions()
  const { data: branches = [], isLoading: branchesLoading } = useBranches()

  const [regionDialog, setRegionDialog] = useState<{ id?: string; name: string; location: string } | null>(null)
  const [branchDialog, setBranchDialog] = useState<{ id?: string; name: string; location: string } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'region' | 'branch'; id: string; name: string } | null>(null)

  const getSupabase = async () => {
    const token = await getToken({ template: 'supabase' })
    if (!token) throw new Error('No auth token')
    return createClerkSupabaseClient(token)
  }

  // ── Region mutations ──────────────────────────────────────────

  const upsertRegion = useMutation({
    mutationFn: async (data: { id?: string; name: string; location: string }) => {
      const supabase = await getSupabase()
      if (data.id) {
        const { error } = await supabase
          .from('regions')
          .update({ name: data.name, location: data.location || null })
          .eq('id', data.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('regions')
          .insert({ name: data.name, location: data.location || null })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'regions'] })
      setRegionDialog(null)
      toast.success('Region saved')
    },
    onError: () => toast.error('Failed to save region'),
  })

  const deleteRegion = useMutation({
    mutationFn: async (id: string) => {
      const supabase = await getSupabase()
      const { error } = await supabase.from('regions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'regions'] })
      setDeleteConfirm(null)
      toast.success('Region deleted')
    },
    onError: () => toast.error('Failed to delete region'),
  })

  // ── Branch mutations ──────────────────────────────────────────

  const upsertBranch = useMutation({
    mutationFn: async (data: { id?: string; name: string; location: string }) => {
      const supabase = await getSupabase()
      if (data.id) {
        const { error } = await supabase
          .from('branches')
          .update({ name: data.name, location: data.location || null })
          .eq('id', data.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('branches')
          .insert({ name: data.name, location: data.location || null })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'branches'] })
      setBranchDialog(null)
      toast.success('Branch saved')
    },
    onError: () => toast.error('Failed to save branch'),
  })

  const deleteBranch = useMutation({
    mutationFn: async (id: string) => {
      const supabase = await getSupabase()
      const { error } = await supabase.from('branches').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'branches'] })
      setDeleteConfirm(null)
      toast.success('Branch deleted')
    },
    onError: () => toast.error('Failed to delete branch'),
  })

  const isLoading = regionsLoading || branchesLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Regions & Branches</h1>
        <p className="text-gray-500 mt-1">
          Manage geographic regions and physical branch offices.
        </p>
      </div>

      {/* ── Regions ──────────────────────────────────────────── */}
      <Card>
        <CardHeader className="border-b bg-muted/50 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="size-4 text-muted-foreground" />
            <CardTitle>Regions</CardTitle>
          </div>
          <Button size="sm" onClick={() => setRegionDialog({ name: '', location: '' })}>
            <Plus className="size-4 mr-1" />
            Add Region
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {regions.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No regions yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="w-[80px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {regions.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.location || '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setRegionDialog({ id: r.id, name: r.name, location: r.location ?? '' })}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setDeleteConfirm({ type: 'region', id: r.id, name: r.name })}
                        >
                          <Trash2 className="size-3.5 text-destructive" />
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

      {/* ── Branches ─────────────────────────────────────────── */}
      <Card>
        <CardHeader className="border-b bg-muted/50 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-muted-foreground" />
            <CardTitle>Branches</CardTitle>
          </div>
          <Button size="sm" onClick={() => setBranchDialog({ name: '', location: '' })}>
            <Plus className="size-4 mr-1" />
            Add Branch
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {branches.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No branches yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="w-[80px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell className="text-muted-foreground">{b.location || '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setBranchDialog({ id: b.id, name: b.name, location: b.location ?? '' })}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setDeleteConfirm({ type: 'branch', id: b.id, name: b.name })}
                        >
                          <Trash2 className="size-3.5 text-destructive" />
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

      {/* ── Region Dialog ────────────────────────────────────── */}
      <Dialog open={!!regionDialog} onOpenChange={(open) => { if (!open) setRegionDialog(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{regionDialog?.id ? 'Edit Region' : 'Add Region'}</DialogTitle>
            <DialogDescription>Enter the region name and optional location.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Name</Label>
              <Input
                value={regionDialog?.name ?? ''}
                onChange={(e) => setRegionDialog((p) => p ? { ...p, name: e.target.value } : p)}
                placeholder="e.g. Aldridge"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Location</Label>
              <Input
                value={regionDialog?.location ?? ''}
                onChange={(e) => setRegionDialog((p) => p ? { ...p, location: e.target.value } : p)}
                placeholder="e.g. Southeast Region"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegionDialog(null)}>Cancel</Button>
            <Button
              onClick={() => regionDialog && upsertRegion.mutate(regionDialog)}
              disabled={upsertRegion.isPending || !regionDialog?.name.trim()}
            >
              {upsertRegion.isPending && <Loader2 className="size-4 mr-1.5 animate-spin" />}
              {regionDialog?.id ? 'Save' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Branch Dialog ────────────────────────────────────── */}
      <Dialog open={!!branchDialog} onOpenChange={(open) => { if (!open) setBranchDialog(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{branchDialog?.id ? 'Edit Branch' : 'Add Branch'}</DialogTitle>
            <DialogDescription>Enter the branch name and location.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Name</Label>
              <Input
                value={branchDialog?.name ?? ''}
                onChange={(e) => setBranchDialog((p) => p ? { ...p, name: e.target.value } : p)}
                placeholder="e.g. Downtown Branch"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Location</Label>
              <Input
                value={branchDialog?.location ?? ''}
                onChange={(e) => setBranchDialog((p) => p ? { ...p, location: e.target.value } : p)}
                placeholder="e.g. San Francisco, CA"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBranchDialog(null)}>Cancel</Button>
            <Button
              onClick={() => branchDialog && upsertBranch.mutate(branchDialog)}
              disabled={upsertBranch.isPending || !branchDialog?.name.trim()}
            >
              {upsertBranch.isPending && <Loader2 className="size-4 mr-1.5 animate-spin" />}
              {branchDialog?.id ? 'Save' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ───────────────────────── */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {deleteConfirm?.type === 'region' ? 'Region' : 'Branch'}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>?
              Users assigned to this {deleteConfirm?.type} will be unassigned.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!deleteConfirm) return
                if (deleteConfirm.type === 'region') deleteRegion.mutate(deleteConfirm.id)
                else deleteBranch.mutate(deleteConfirm.id)
              }}
              disabled={deleteRegion.isPending || deleteBranch.isPending}
            >
              {(deleteRegion.isPending || deleteBranch.isPending) && <Loader2 className="size-4 mr-1.5 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
