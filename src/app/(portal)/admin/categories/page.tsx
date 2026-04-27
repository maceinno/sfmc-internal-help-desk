'use client'

import { useState, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClerkSupabaseClient } from '@/lib/supabase/client'
import {
  seedDepartmentViews,
  renameDepartmentViews,
  deleteDepartmentViews,
} from '@/lib/views/department-views'
import { toast } from 'sonner'
import {
  Plus,
  Trash2,
  Edit3,
  FileText,
  Shield,
  X,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
import { Label } from '@/components/ui/label'

// ── Types ───────────────────────────────────────────────────────

interface CategoryOption {
  name: string
  subCategories?: string[]
}

/** Raw DB row shape */
interface DbCategoryRow {
  id: string
  ticket_type: string
  category_name: string
  sub_categories: string[] | null
  sort_order: number
}

/** Grouped shape the UI works with */
interface DepartmentCategoryRow {
  ticket_type: string
  categories: (CategoryOption & { dbId: string })[]
}

// ── Hook ────────────────────────────────────────────────────────

function useDepartmentCategories() {
  const { getToken } = useAuth()

  return useQuery<DepartmentCategoryRow[]>({
    queryKey: ['admin', 'departmentCategories'],
    queryFn: async () => {
      const token = await getToken({ template: 'supabase' })
      if (!token) throw new Error('No auth token')
      const supabase = createClerkSupabaseClient(token)
      const { data, error } = await supabase
        .from('department_categories')
        .select('*')
        .order('ticket_type', { ascending: true })
        .order('sort_order', { ascending: true })
      if (error) throw error

      // Group flat rows by ticket_type
      const grouped = new Map<string, (CategoryOption & { dbId: string })[]>()
      for (const row of data as DbCategoryRow[]) {
        if (!grouped.has(row.ticket_type)) {
          grouped.set(row.ticket_type, [])
        }
        grouped.get(row.ticket_type)!.push({
          dbId: row.id,
          name: row.category_name,
          subCategories: row.sub_categories?.length ? row.sub_categories : undefined,
        })
      }

      return Array.from(grouped.entries()).map(([ticket_type, categories]) => ({
        ticket_type,
        categories,
      }))
    },
  })
}

// ── Page ────────────────────────────────────────────────────────

export default function CategoriesPage() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const { data: rows, isLoading } = useDepartmentCategories()

  // Add department
  const [showAddDept, setShowAddDept] = useState(false)
  const [newDeptName, setNewDeptName] = useState('')

  // Edit category dialog
  const [editDialog, setEditDialog] = useState<{
    rowId: string
    ticketType: string
    catIndex: number
    category: CategoryOption
  } | null>(null)
  const [editName, setEditName] = useState('')
  const [editSubs, setEditSubs] = useState<string[]>([])
  const [newSubInput, setNewSubInput] = useState('')

  // Add category inline
  const [addCatFor, setAddCatFor] = useState<string | null>(null)
  const [newCatName, setNewCatName] = useState('')

  // Edit ticket type name
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null)
  const [editDeptName, setEditDeptName] = useState('')

  // ── Mutations ───────────────────────────────────────────────

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'departmentCategories'] })
    // Department views are derived from departments; refresh them too.
    queryClient.invalidateQueries({ queryKey: ['admin', 'viewConfigs'] })
  }

  const getSupabase = async () => {
    const token = await getToken({ template: 'supabase' })
    if (!token) throw new Error('No auth token')
    return createClerkSupabaseClient(token)
  }

  const insertCategory = useMutation({
    mutationFn: async (row: {
      ticket_type: string
      category_name: string
      sub_categories?: string[]
    }) => {
      const supabase = await getSupabase()
      const { error } = await supabase
        .from('department_categories')
        .insert(row)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const updateCategory = useMutation({
    mutationFn: async (row: {
      id: string
      category_name?: string
      sub_categories?: string[] | null
      ticket_type?: string
    }) => {
      const supabase = await getSupabase()
      const { id, ...payload } = row
      const { error } = await supabase
        .from('department_categories')
        .update(payload)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const supabase = await getSupabase()
      const { error } = await supabase
        .from('department_categories')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const deleteDepartment = useMutation({
    mutationFn: async (ticketType: string) => {
      const supabase = await getSupabase()
      const { error } = await supabase
        .from('department_categories')
        .delete()
        .eq('ticket_type', ticketType)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const renameDepartment = useMutation({
    mutationFn: async ({ oldName, newName }: { oldName: string; newName: string }) => {
      const supabase = await getSupabase()
      const { error } = await supabase
        .from('department_categories')
        .update({ ticket_type: newName })
        .eq('ticket_type', oldName)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  // ── Handlers ──────────────────────────────────────────────

  const handleAddDept = useCallback(async () => {
    const name = newDeptName.trim()
    if (!name) return
    if (rows?.some((r) => r.ticket_type === name)) {
      toast.error('A department with that name already exists')
      return
    }
    try {
      // Insert a placeholder category so the department shows up
      await insertCategory.mutateAsync({
        ticket_type: name,
        category_name: 'General',
      })
      // Seed the per-department template views (best-effort; don't roll
      // back the department add if this fails).
      try {
        const supabase = await getSupabase()
        await seedDepartmentViews(supabase, name)
      } catch (err) {
        console.error('Failed to seed views for new department', err)
      }
      toast.success(`Department "${name}" added`)
      setNewDeptName('')
      setShowAddDept(false)
    } catch {
      toast.error('Failed to add department')
    }
  }, [newDeptName, rows, insertCategory])

  const handleDeleteDept = useCallback(
    async (row: DepartmentCategoryRow) => {
      try {
        await deleteDepartment.mutateAsync(row.ticket_type)
        // Tear down the department's views alongside it.
        try {
          const supabase = await getSupabase()
          await deleteDepartmentViews(supabase, row.ticket_type)
        } catch (err) {
          console.error('Failed to delete views for department', err)
        }
        toast.success(`Department "${row.ticket_type}" deleted`)
      } catch {
        toast.error('Failed to delete department')
      }
    },
    [deleteDepartment],
  )

  const handleRenameDept = useCallback(
    async (row: DepartmentCategoryRow, newName: string) => {
      const trimmed = newName.trim()
      if (!trimmed || trimmed === row.ticket_type) {
        setEditingDeptId(null)
        return
      }
      if (rows?.some((r) => r.ticket_type === trimmed && r.ticket_type !== row.ticket_type)) {
        toast.error('A department with that name already exists')
        return
      }
      try {
        await renameDepartment.mutateAsync({
          oldName: row.ticket_type,
          newName: trimmed,
        })
        // Keep the department's views aligned with the new name.
        try {
          const supabase = await getSupabase()
          await renameDepartmentViews(supabase, row.ticket_type, trimmed)
        } catch (err) {
          console.error('Failed to rename views for department', err)
        }
        toast.success('Department renamed')
        setEditingDeptId(null)
      } catch {
        toast.error('Failed to rename department')
      }
    },
    [rows, renameDepartment],
  )

  const handleAddCategory = useCallback(
    async (row: DepartmentCategoryRow) => {
      const name = newCatName.trim()
      if (!name) return
      if (row.categories.some((c) => c.name === name)) {
        toast.error('Category already exists in this department')
        return
      }
      try {
        await insertCategory.mutateAsync({
          ticket_type: row.ticket_type,
          category_name: name,
        })
        toast.success(`Category "${name}" added`)
        setNewCatName('')
        setAddCatFor(null)
      } catch {
        toast.error('Failed to add category')
      }
    },
    [newCatName, insertCategory],
  )

  const handleDeleteCategory = useCallback(
    async (_row: DepartmentCategoryRow, catIndex: number, cat: CategoryOption & { dbId: string }) => {
      try {
        await deleteCategory.mutateAsync(cat.dbId)
        toast.success(`Category "${cat.name}" deleted`)
      } catch {
        toast.error('Failed to delete category')
      }
    },
    [deleteCategory],
  )

  const handleSaveEditCategory = useCallback(async () => {
    if (!editDialog) return
    const row = rows?.find((r) => r.ticket_type === editDialog.ticketType)
    if (!row) return

    const cat = row.categories[editDialog.catIndex]
    if (!cat) return

    try {
      await updateCategory.mutateAsync({
        id: cat.dbId,
        category_name: editName.trim() || editDialog.category.name,
        sub_categories: editSubs.length > 0 ? editSubs : null,
      })
      toast.success('Category updated')
      setEditDialog(null)
    } catch {
      toast.error('Failed to update category')
    }
  }, [editDialog, rows, editName, editSubs, updateCategory])

  const openEditDialog = useCallback(
    (row: DepartmentCategoryRow, catIndex: number) => {
      const cat = row.categories[catIndex]
      setEditDialog({
        rowId: cat.dbId,
        ticketType: row.ticket_type,
        catIndex,
        category: cat,
      })
      setEditName(cat.name)
      setEditSubs(cat.subCategories ? [...cat.subCategories] : [])
      setNewSubInput('')
    },
    [],
  )

  // ── Loading ───────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Departments & Categories</h1>
          <p className="text-sm text-muted-foreground">
            Manage ticket types and their category trees.
          </p>
        </div>
        <Button onClick={() => setShowAddDept(true)}>
          <Plus className="size-4 mr-1.5" />
          Add Department
        </Button>
      </div>

      {/* Add department inline */}
      {showAddDept && (
        <Card>
          <CardContent className="flex items-center gap-3">
            <Input
              value={newDeptName}
              onChange={(e) => setNewDeptName(e.target.value)}
              placeholder="Department name"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddDept()
                if (e.key === 'Escape') {
                  setShowAddDept(false)
                  setNewDeptName('')
                }
              }}
            />
            <Button
              onClick={handleAddDept}
              disabled={insertCategory.isPending || updateCategory.isPending}
            >
              Save
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setShowAddDept(false)
                setNewDeptName('')
              }}
            >
              Cancel
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Department sections */}
      {(!rows || rows.length === 0) && !showAddDept && (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-12 text-center">
          <Shield className="size-12 text-muted-foreground mb-3" />
          <p className="font-medium text-muted-foreground">
            No departments yet
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Add a department to get started.
          </p>
        </div>
      )}

      {rows?.map((row) => (
        <Card key={row.ticket_type}>
          {/* Department header */}
          <CardHeader className="border-b bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="size-4 text-muted-foreground" />
                {editingDeptId === row.ticket_type ? (
                  <Input
                    className="h-7 w-60 text-sm font-semibold"
                    defaultValue={row.ticket_type}
                    autoFocus
                    onBlur={(e) =>
                      handleRenameDept(row, e.target.value)
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter')
                        handleRenameDept(
                          row,
                          e.currentTarget.value,
                        )
                      if (e.key === 'Escape') setEditingDeptId(null)
                    }}
                  />
                ) : (
                  <CardTitle>{row.ticket_type}</CardTitle>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    setEditingDeptId(row.ticket_type)
                    setEditDeptName(row.ticket_type)
                  }}
                  title="Rename"
                >
                  <Edit3 className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleDeleteDept(row)}
                  title="Delete department"
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {/* Categories list */}
            {row.categories.map((cat, catIndex) => (
              <div
                key={cat.name}
                className="rounded-lg border bg-muted/30 p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <FileText className="size-4 text-muted-foreground" />
                    {cat.name}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => openEditDialog(row, catIndex)}
                      title="Edit category"
                    >
                      <Edit3 className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() =>
                        handleDeleteCategory(row, catIndex, cat)
                      }
                      title="Delete category"
                    >
                      <Trash2 className="size-3 text-destructive" />
                    </Button>
                  </div>
                </div>

                {/* Subcategory chips */}
                {cat.subCategories && cat.subCategories.length > 0 && (
                  <div className="ml-6 flex flex-wrap gap-1.5">
                    {cat.subCategories.map((sub) => (
                      <Badge
                        key={sub}
                        variant="secondary"
                        className="gap-1"
                      >
                        <ChevronRight className="size-3 text-muted-foreground" />
                        {sub}
                      </Badge>
                    ))}
                  </div>
                )}

                {(!cat.subCategories ||
                  cat.subCategories.length === 0) && (
                  <p className="ml-6 text-xs text-muted-foreground">
                    No subcategories
                  </p>
                )}
              </div>
            ))}

            {/* Add category */}
            {addCatFor === row.ticket_type ? (
              <div className="flex items-center gap-2 rounded-lg border p-3">
                <Input
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Category name"
                  className="h-7 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddCategory(row)
                    if (e.key === 'Escape') {
                      setAddCatFor(null)
                      setNewCatName('')
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={() => handleAddCategory(row)}
                  disabled={insertCategory.isPending || updateCategory.isPending}
                >
                  Add
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAddCatFor(null)
                    setNewCatName('')
                  }}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="text-primary"
                onClick={() => {
                  setAddCatFor(row.ticket_type)
                  setNewCatName('')
                }}
              >
                <Plus className="size-3 mr-1" />
                Add Category
              </Button>
            )}
          </CardContent>
        </Card>
      ))}

      {/* ── Edit category dialog ──────────────────────────── */}
      <Dialog
        open={!!editDialog}
        onOpenChange={(open) => {
          if (!open) setEditDialog(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>
              Update the category name and manage subcategories.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Category Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label>Subcategories</Label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {editSubs.map((sub, i) => (
                  <Badge
                    key={sub}
                    variant="secondary"
                    className="gap-1 pr-1"
                  >
                    {sub}
                    <button
                      type="button"
                      className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                      onClick={() =>
                        setEditSubs(editSubs.filter((_, j) => j !== i))
                      }
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Input
                  value={newSubInput}
                  onChange={(e) => setNewSubInput(e.target.value)}
                  placeholder="Add subcategory..."
                  className="h-7 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newSubInput.trim()) {
                      const val = newSubInput.trim()
                      if (!editSubs.includes(val)) {
                        setEditSubs([...editSubs, val])
                      }
                      setNewSubInput('')
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const val = newSubInput.trim()
                    if (val && !editSubs.includes(val)) {
                      setEditSubs([...editSubs, val])
                    }
                    setNewSubInput('')
                  }}
                >
                  <Plus className="size-3 mr-1" />
                  Add
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEditCategory}
              disabled={insertCategory.isPending || updateCategory.isPending}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
