'use client'

import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Trash2, Pencil, Users2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClerkSupabaseClient } from '@/lib/supabase/client'
import { useTeams } from '@/hooks/use-admin-config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

interface TeamRow {
  id: string
  name: string
}

export default function AdminTeamsPage() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const { data: teams = [], isLoading } = useTeams()

  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState<TeamRow | null>(null)
  const [deleting, setDeleting] = useState<TeamRow | null>(null)

  function invalidateTeams() {
    queryClient.invalidateQueries({ queryKey: ['admin', 'teams'] })
  }

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const token = await getToken({ template: 'supabase' })
      if (!token) throw new Error('No auth token')
      const supabase = createClerkSupabaseClient(token)
      const { error } = await supabase.from('teams').insert({ name })
      if (error) throw error
    },
    onSuccess: () => {
      invalidateTeams()
      setAddOpen(false)
      setNewName('')
      toast.success('Team created')
    },
    onError: (err: Error) => toast.error(`Failed to create team: ${err.message}`),
  })

  const renameMutation = useMutation({
    mutationFn: async (input: { id: string; name: string }) => {
      const token = await getToken({ template: 'supabase' })
      if (!token) throw new Error('No auth token')
      const supabase = createClerkSupabaseClient(token)
      const { error } = await supabase
        .from('teams')
        .update({ name: input.name })
        .eq('id', input.id)
      if (error) throw error
    },
    onSuccess: () => {
      invalidateTeams()
      setEditing(null)
      toast.success('Team renamed')
    },
    onError: (err: Error) => toast.error(`Failed to rename: ${err.message}`),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken({ template: 'supabase' })
      if (!token) throw new Error('No auth token')
      const supabase = createClerkSupabaseClient(token)
      const { error } = await supabase.from('teams').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      invalidateTeams()
      setDeleting(null)
      toast.success('Team deleted')
    },
    onError: (err: Error) => toast.error(`Failed to delete: ${err.message}`),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Teams</h2>
          <p className="text-sm text-gray-500">
            Manage the teams an agent can be assigned to and that routing
            rules can target. The team list also drives the ticket sidebar
            Team dropdown.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          New Team
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading teams…
            </div>
          ) : teams.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">
              No teams yet. Click <span className="font-medium">New Team</span> to add one.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {(teams as TeamRow[]).map((team) => (
                <li
                  key={team.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <Users2 className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {team.name}
                      </p>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {team.id}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing(team)}
                      title="Rename team"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleting(team)}
                      title="Delete team"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Add Team */}
      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open)
          if (!open) setNewName('')
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Team</DialogTitle>
            <DialogDescription>
              Add a team that agents can join and routing rules can target.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="team-name">Team name</Label>
            <Input
              id="team-name"
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Doc Magic Support"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddOpen(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate(newName.trim())}
              disabled={!newName.trim() || createMutation.isPending}
            >
              {createMutation.isPending && (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              )}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename */}
      <Dialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Team</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename-team">Team name</Label>
            <Input
              id="rename-team"
              autoFocus
              value={editing?.name ?? ''}
              onChange={(e) =>
                setEditing((prev) => (prev ? { ...prev, name: e.target.value } : prev))
              }
            />
            <p className="font-mono text-[11px] text-muted-foreground">
              {editing?.id}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditing(null)}
              disabled={renameMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                editing && renameMutation.mutate({ id: editing.id, name: editing.name.trim() })
              }
              disabled={
                !editing?.name.trim() || renameMutation.isPending
              }
            >
              {renameMutation.isPending && (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Team</DialogTitle>
            <DialogDescription>
              Delete <span className="font-medium">{deleting?.name}</span>?
              Agents currently assigned to this team will keep working but
              will no longer be on a team. Routing rules pointing at this
              team will fall back to no-team. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleting(null)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
