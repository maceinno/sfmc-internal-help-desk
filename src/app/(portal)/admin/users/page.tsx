'use client'

import { useState, useMemo } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Loader2,
  Search,
  Pencil,
  Users,
  UserPlus,
  Eye,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClerkSupabaseClient } from '@/lib/supabase/client'
import {
  useTeams,
  useBranches,
  useRegions,
  useDepartmentCategories,
} from '@/hooks/use-admin-config'
import type { User, TicketType } from '@/types'
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

const ROWS_PER_PAGE = 15

const ROLE_OPTIONS: { value: User['role']; label: string }[] = [
  { value: 'employee', label: 'Employee' },
  { value: 'agent', label: 'Agent' },
  { value: 'admin', label: 'Admin' },
]

const ROLE_FILTER_OPTIONS = [
  { value: 'all', label: 'All Roles' },
  ...ROLE_OPTIONS,
]

// ── Types ──────────────────────────────────────────────────────

interface UserFormState {
  id: string
  name: string
  email: string
  role: User['role']
  department: string
  departments: string[]
  teamIds: string[]
  branchId: string
  regionId: string
  isOutOfOffice: boolean
  ticketTypesHandled: TicketType[]
  hasBranchAccess: boolean
  managedBranchId: string
  hasRegionalAccess: boolean
  managedRegionId: string
}

// ── Hook: Fetch all users ──────────────────────────────────────

function useUsers() {
  const { getToken } = useAuth()

  return useQuery<User[]>({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const token = await getToken({ template: 'supabase' })
      if (!token) throw new Error('No auth token')
      const supabase = createClerkSupabaseClient(token)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('name', { ascending: true })
      if (error) throw error
      return data as User[]
    },
  })
}

// ── Page Component ─────────────────────────────────────────────

export default function UsersPage() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const { data: users = [], isLoading } = useUsers()
  const { data: teams = [] } = useTeams()
  const { data: branches = [] } = useBranches()
  const { data: regions = [] } = useRegions()
  const { data: departmentGroups = [] } = useDepartmentCategories()
  const departmentNames = useMemo(
    () => departmentGroups.map((g) => g.ticket_type),
    [departmentGroups],
  )

  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<UserFormState | null>(null)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [addForm, setAddForm] = useState({
    name: '',
    email: '',
    role: 'employee' as User['role'],
    department: '',
    teamIds: [] as string[],
    branchId: '',
    regionId: '',
    hasBranchAccess: false,
    managedBranchId: '',
    hasRegionalAccess: false,
    managedRegionId: '',
  })

  // ── Filtered list ──────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = users
    if (roleFilter !== 'all') {
      list = list.filter((u) => u.role === roleFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q),
      )
    }
    return list
  }, [users, searchQuery, roleFilter])

  // Reset to page 1 when filters change
  useMemo(() => {
    setCurrentPage(1)
  }, [searchQuery, roleFilter])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedUsers = useMemo(() => {
    const start = (safePage - 1) * ROWS_PER_PAGE
    return filtered.slice(start, start + ROWS_PER_PAGE)
  }, [filtered, safePage])

  // ── Mutation ───────────────────────────────────────────────

  const updateMutation = useMutation({
    mutationFn: async (data: UserFormState) => {
      const token = await getToken({ template: 'supabase' })
      if (!token) throw new Error('No auth token')
      const supabase = createClerkSupabaseClient(token)

      const payload = {
        name: data.name,
        role: data.role,
        department: data.department || null,
        departments: data.departments.length > 0 ? data.departments : null,
        team_ids: data.teamIds.length > 0 ? data.teamIds : null,
        branch_id: data.branchId || null,
        region_id: data.regionId || null,
        is_out_of_office: data.isOutOfOffice,
        ticket_types_handled:
          data.ticketTypesHandled.length > 0
            ? data.ticketTypesHandled
            : null,
        has_branch_access: data.hasBranchAccess,
        managed_branch_id: data.hasBranchAccess
          ? data.managedBranchId || null
          : null,
        has_regional_access: data.hasRegionalAccess,
        managed_region_id: data.hasRegionalAccess
          ? data.managedRegionId || null
          : null,
      }

      const { error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', data.id)
      if (error) throw error

      // Sync role & access flags to Clerk publicMetadata so the
      // middleware can enforce route access without a DB call.
      const res = await fetch('/api/users/sync-clerk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: data.id }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to sync role to Clerk')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      setDialogOpen(false)
      toast.success('User updated')
    },
    onError: (err: Error) => {
      toast.error(`Failed to update: ${err.message}`)
    },
  })

  const createMutation = useMutation({
    mutationFn: async (data: typeof addForm) => {
      const res = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          role: data.role,
          department: data.department || undefined,
          teamIds: data.teamIds.length > 0 ? data.teamIds : undefined,
          branchId: data.branchId || undefined,
          regionId: data.regionId || undefined,
          hasBranchAccess: data.hasBranchAccess,
          managedBranchId: data.hasBranchAccess ? data.managedBranchId || undefined : undefined,
          hasRegionalAccess: data.hasRegionalAccess,
          managedRegionId: data.hasRegionalAccess ? data.managedRegionId || undefined : undefined,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to create user')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      setAddDialogOpen(false)
      setAddForm({
        name: '', email: '', role: 'employee', department: '',
        teamIds: [], branchId: '', regionId: '',
        hasBranchAccess: false, managedBranchId: '',
        hasRegionalAccess: false, managedRegionId: '',
      })
      toast.success('User created — they will receive an email to set their password')
    },
    onError: (err: Error) => {
      toast.error(`Failed to create user: ${err.message}`)
    },
  })

  // ── Helpers ────────────────────────────────────────────────

  function openEdit(u: User) {
    setForm({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      department: u.department ?? '',
      departments: u.departments ?? [],
      teamIds: u.team_ids ?? [],
      branchId: u.branch_id ?? '',
      regionId: u.region_id ?? '',
      isOutOfOffice: u.is_out_of_office ?? false,
      ticketTypesHandled: u.ticket_types_handled ?? [],
      hasBranchAccess: u.has_branch_access ?? false,
      managedBranchId: u.managed_branch_id ?? '',
      hasRegionalAccess: u.has_regional_access ?? false,
      managedRegionId: u.managed_region_id ?? '',
    })
    setDialogOpen(true)
  }

  function toggleTeam(teamId: string) {
    if (!form) return
    setForm((f) => {
      if (!f) return f
      const current = f.teamIds
      return {
        ...f,
        teamIds: current.includes(teamId)
          ? current.filter((id) => id !== teamId)
          : [...current, teamId],
      }
    })
  }

  function toggleDepartment(dept: string) {
    if (!form) return
    setForm((f) => {
      if (!f) return f
      const current = f.departments
      return {
        ...f,
        departments: current.includes(dept)
          ? current.filter((d) => d !== dept)
          : [...current, dept],
      }
    })
  }

  function toggleTicketType(tt: string) {
    if (!form) return
    setForm((f) => {
      if (!f) return f
      const current = f.ticketTypesHandled
      return {
        ...f,
        ticketTypesHandled: current.includes(tt as TicketType)
          ? current.filter((t) => t !== tt)
          : [...current, tt as TicketType],
      }
    })
  }

  function getTeamName(id: string) {
    return teams.find((t) => t.id === id)?.name ?? id
  }

  function getBranchName(id: string) {
    return branches.find((b) => b.id === id)?.name ?? id
  }

  function getRegionName(id: string) {
    return regions.find((r) => r.id === id)?.name ?? id
  }

  // ── Loading state ──────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm font-medium">Loading users...</p>
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-500 mt-1">
            Manage user roles, teams, and access settings.
          </p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <UserPlus className="w-4 h-4 mr-1.5" />
          Add User
        </Button>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or email..."
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={(val) => setRoleFilter(val ?? 'all')}>
          <SelectTrigger className="w-[160px]">
            <SelectValue>
              {(val: string) =>
                ROLE_FILTER_OPTIONS.find((o) => o.value === val)?.label ?? 'All Roles'
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ROLE_FILTER_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No users found</p>
              <p className="text-sm text-gray-400 mt-1">
                {searchQuery || roleFilter !== 'all'
                  ? 'Try adjusting your filters.'
                  : 'No users have been synced yet.'}
              </p>
            </div>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Teams</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead className="w-[60px] text-center">OOO</TableHead>
                  <TableHead className="w-[60px] text-right">&nbsp;</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedUsers.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.email}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          u.role === 'admin'
                            ? 'default'
                            : u.role === 'agent'
                              ? 'secondary'
                              : 'outline'
                        }
                      >
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.department ?? '--'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(u.team_ids ?? []).length > 0 ? (
                          (u.team_ids ?? []).map((tid) => (
                            <Badge
                              key={tid}
                              variant="outline"
                              className="text-[10px]"
                            >
                              {getTeamName(tid)}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.branch_id ? getBranchName(u.branch_id) : '--'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.region_id ? getRegionName(u.region_id) : '--'}
                    </TableCell>
                    <TableCell className="text-center">
                      {u.is_out_of_office ? (
                        <Badge variant="destructive" className="text-[10px]">
                          OOO
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="View as this user"
                          onClick={async () => {
                            try {
                              const res = await fetch('/api/users/assume', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ userId: u.id }),
                              })
                              if (!res.ok) {
                                const err = await res.json().catch(() => ({}))
                                throw new Error(err.error ?? 'Failed')
                              }
                              toast.success(`Now viewing as ${u.name}`)
                              // Redirect to appropriate page for the assumed role
                              const dest = u.role === 'employee' ? '/my-tickets' : '/dashboard'
                              window.location.href = dest
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : 'Failed to assume user')
                            }
                          }}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEdit(u)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Showing {(safePage - 1) * ROWS_PER_PAGE + 1}–{Math.min(safePage * ROWS_PER_PAGE, filtered.length)} of {filtered.length} users
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous
                  </Button>
                  <div className="flex items-center gap-1 mx-2">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <Button
                        key={page}
                        variant={page === safePage ? 'default' : 'outline'}
                        size="sm"
                        className="w-8 h-8 p-0"
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </Button>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={safePage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Edit Dialog ───────────────────────────────────────── */}
      {form && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                Update profile metadata for {form.name}. Name and email are
                managed by Clerk.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              {/* Name (editable) */}
              <div className="grid gap-1.5">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => f ? { ...f, name: e.target.value } : f)}
                />
              </div>

              {/* Email (read-only) */}
              <div className="grid gap-1.5">
                <Label>Email</Label>
                <Input value={form.email} disabled />
                <p className="text-xs text-muted-foreground">Email is managed by Clerk and cannot be changed here.</p>
              </div>

              {/* Role */}
              <div className="grid gap-1.5">
                <Label>Role</Label>
                <Select
                  value={form.role}
                  onValueChange={(val) =>
                    setForm((f) =>
                      f && val ? { ...f, role: val as User['role'] } : f,
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(val: string) =>
                        ROLE_OPTIONS.find((o) => o.value === val)?.label ?? val
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Department */}
              <div className="grid gap-1.5">
                <Label>Primary Department</Label>
                <Input
                  value={form.department}
                  onChange={(e) =>
                    setForm((f) =>
                      f ? { ...f, department: e.target.value } : f,
                    )
                  }
                  placeholder="e.g. IT, Closing, Lending"
                />
              </div>

              {/* Departments (multi-value via chip toggle) */}
              <div className="grid gap-1.5">
                <Label>Departments (multi)</Label>
                <div className="flex flex-wrap gap-1.5 p-2 border rounded-lg min-h-[42px]">
                  {departmentNames.map((dept) => {
                    const selected = form.departments.includes(dept)
                    return (
                      <button
                        key={dept}
                        type="button"
                        onClick={() => toggleDepartment(dept)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                          selected
                            ? 'bg-primary/10 text-primary border-primary/30'
                            : 'bg-background text-muted-foreground border-border hover:border-foreground/30'
                        }`}
                      >
                        {dept}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Teams (multi-select) */}
              <div className="grid gap-1.5">
                <Label>Team Assignments</Label>
                <div className="flex flex-wrap gap-1.5 p-2 border rounded-lg min-h-[42px]">
                  {teams.map((t) => {
                    const selected = form.teamIds.includes(t.id)
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleTeam(t.id)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                          selected
                            ? 'bg-primary/10 text-primary border-primary/30'
                            : 'bg-background text-muted-foreground border-border hover:border-foreground/30'
                        }`}
                      >
                        {t.name}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Branch */}
              <div className="grid gap-1.5">
                <Label>Branch</Label>
                <Select
                  value={form.branchId || '__none__'}
                  onValueChange={(val) =>
                    setForm((f) =>
                      f
                        ? { ...f, branchId: !val || val === '__none__' ? '' : val }
                        : f,
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Unassigned">
                      {(val: string) =>
                        !val || val === '__none__' ? 'Unassigned' : getBranchName(val)
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unassigned</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Region */}
              <div className="grid gap-1.5">
                <Label>Region</Label>
                <Select
                  value={form.regionId || '__none__'}
                  onValueChange={(val) =>
                    setForm((f) =>
                      f
                        ? { ...f, regionId: !val || val === '__none__' ? '' : val }
                        : f,
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Unassigned">
                      {(val: string) =>
                        !val || val === '__none__' ? 'Unassigned' : getRegionName(val)
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unassigned</SelectItem>
                    {regions.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Branch Manager toggle + managed branch */}
              <div className="border rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Branch Manager</p>
                    <p className="text-xs text-muted-foreground">
                      Can manage a specific branch
                    </p>
                  </div>
                  <Switch
                    checked={form.hasBranchAccess}
                    onCheckedChange={(checked) =>
                      setForm((f) =>
                        f
                          ? {
                              ...f,
                              hasBranchAccess: checked,
                              managedBranchId: checked
                                ? f.managedBranchId
                                : '',
                            }
                          : f,
                      )
                    }
                  />
                </div>
                {form.hasBranchAccess && (
                  <Select
                    value={form.managedBranchId || '__none__'}
                    onValueChange={(val) =>
                      setForm((f) =>
                        f
                          ? {
                              ...f,
                              managedBranchId:
                                !val || val === '__none__' ? '' : val,
                            }
                          : f,
                      )
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select managed branch...">
                        {(val: string) =>
                          !val || val === '__none__' ? 'None' : getBranchName(val)
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Regional Manager toggle + managed region */}
              <div className="border rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Regional Manager</p>
                    <p className="text-xs text-muted-foreground">
                      Can manage a specific region
                    </p>
                  </div>
                  <Switch
                    checked={form.hasRegionalAccess}
                    onCheckedChange={(checked) =>
                      setForm((f) =>
                        f
                          ? {
                              ...f,
                              hasRegionalAccess: checked,
                              managedRegionId: checked
                                ? f.managedRegionId
                                : '',
                            }
                          : f,
                      )
                    }
                  />
                </div>
                {form.hasRegionalAccess && (
                  <Select
                    value={form.managedRegionId || '__none__'}
                    onValueChange={(val) =>
                      setForm((f) =>
                        f
                          ? {
                              ...f,
                              managedRegionId:
                                !val || val === '__none__' ? '' : val,
                            }
                          : f,
                      )
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select managed region...">
                        {(val: string) =>
                          !val || val === '__none__' ? 'None' : getRegionName(val)
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {regions.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Ticket Types Handled (multi-select) */}
              <div className="grid gap-1.5">
                <Label>Ticket Types Handled</Label>
                <div className="flex flex-wrap gap-1.5 p-2 border rounded-lg min-h-[42px]">
                  {departmentNames.map((tt) => {
                    const selected = form.ticketTypesHandled.includes(tt as TicketType)
                    return (
                      <button
                        key={tt}
                        type="button"
                        onClick={() => toggleTicketType(tt)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                          selected
                            ? 'bg-primary/10 text-primary border-primary/30'
                            : 'bg-background text-muted-foreground border-border hover:border-foreground/30'
                        }`}
                      >
                        {tt}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Out of Office toggle */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Out of Office</p>
                  <p className="text-xs text-muted-foreground">
                    Mark this user as unavailable
                  </p>
                </div>
                <Switch
                  checked={form.isOutOfOffice}
                  onCheckedChange={(checked) =>
                    setForm((f) =>
                      f ? { ...f, isOutOfOffice: checked } : f,
                    )
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={() => form && updateMutation.mutate(form)}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                )}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Add User Dialog ──────────────────────────────────── */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new user account. They will receive an email to set their password.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Name */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Name</Label>
                <Input
                  value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="John Doe"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="john@example.com"
                />
              </div>
            </div>

            {/* Role + Region */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Role</Label>
                <Select
                  value={addForm.role}
                  onValueChange={(val) =>
                    setAddForm((f) => val ? { ...f, role: val as User['role'] } : f)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(val: string) =>
                        ROLE_OPTIONS.find((o) => o.value === val)?.label ?? val
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Region</Label>
                <Select
                  value={addForm.regionId || '__none__'}
                  onValueChange={(val) =>
                    setAddForm((f) => ({
                      ...f,
                      regionId: !val || val === '__none__' ? '' : val,
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Unassigned">
                      {(val: string) =>
                        !val || val === '__none__' ? 'Unassigned' : getRegionName(val)
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unassigned</SelectItem>
                    {regions.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Branch */}
            <div className="grid gap-1.5">
              <Label>Branch</Label>
              <Select
                value={addForm.branchId || '__none__'}
                onValueChange={(val) =>
                  setAddForm((f) => ({
                    ...f,
                    branchId: !val || val === '__none__' ? '' : val,
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Unassigned">
                    {(val: string) =>
                      !val || val === '__none__' ? 'Unassigned' : getBranchName(val)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Access toggles */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Regional Access</p>
                </div>
                <Switch
                  checked={addForm.hasRegionalAccess}
                  onCheckedChange={(checked) =>
                    setAddForm((f) => ({
                      ...f,
                      hasRegionalAccess: checked,
                      managedRegionId: checked ? f.managedRegionId : '',
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Branch Access</p>
                </div>
                <Switch
                  checked={addForm.hasBranchAccess}
                  onCheckedChange={(checked) =>
                    setAddForm((f) => ({
                      ...f,
                      hasBranchAccess: checked,
                      managedBranchId: checked ? f.managedBranchId : '',
                    }))
                  }
                />
              </div>
            </div>

            {/* Teams */}
            <div className="grid gap-1.5">
              <Label>Teams</Label>
              <div className="flex flex-wrap gap-1.5 p-2 border rounded-lg min-h-[42px]">
                {teams.map((t) => {
                  const selected = addForm.teamIds.includes(t.id)
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() =>
                        setAddForm((f) => ({
                          ...f,
                          teamIds: selected
                            ? f.teamIds.filter((id) => id !== t.id)
                            : [...f.teamIds, t.id],
                        }))
                      }
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        selected
                          ? 'bg-primary/10 text-primary border-primary/30'
                          : 'bg-background text-muted-foreground border-border hover:border-foreground/30'
                      }`}
                    >
                      {t.name}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddDialogOpen(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate(addForm)}
              disabled={createMutation.isPending || !addForm.name.trim() || !addForm.email.trim()}
            >
              {createMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              )}
              Add User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
