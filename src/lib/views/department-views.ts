import type { SupabaseClient } from '@supabase/supabase-js'
import type { ViewFilterConfig } from '@/types/ticket'

/**
 * Add any not-yet-known department to the collapsed map, defaulting it to
 * collapsed — and return the EXACT SAME OBJECT when there is nothing to add.
 *
 * Returning `prev` unchanged is the whole point, not an optimisation. This
 * runs from a `useEffect` in the tickets layout, and the previous version
 * built `{ ...prev }` every time. That is a new object identity, so React
 * treated every run as a real state change and re-rendered; the effect's
 * dependency (`departmentNames`) is itself rebuilt whenever the department
 * query has no data yet — `useDepartmentCategories()` destructures with a
 * `= []` default, which is a fresh array on each render — so the effect re-ran,
 * set state again, and the two ping-ponged until React aborted with
 * "Maximum update depth exceeded" and the tickets page died.
 *
 * With an unchanged return there is no state update, so the cycle cannot
 * start regardless of how often the effect fires.
 */
export function withNewDepartmentsCollapsed(
  prev: Record<string, boolean>,
  departmentNames: readonly string[],
): Record<string, boolean> {
  const missing = departmentNames.filter((d) => prev[d] === undefined)
  if (missing.length === 0) return prev

  const next = { ...prev }
  for (const dept of missing) next[dept] = true
  return next
}

/**
 * Per-department template views. Each department gets these five.
 * Mirrors the original prototype's "New / Open / Pending / On Hold /
 * Unsolved" set, but filters by ticket_type via ticketTypeFilter.
 */
const TEMPLATES: ReadonlyArray<{
  suffix: string
  name: string
  filter: Pick<ViewFilterConfig, 'statusFilter'>
}> = [
  { suffix: 'new', name: 'New Tickets', filter: { statusFilter: 'new' } },
  { suffix: 'open', name: 'Open Tickets', filter: { statusFilter: 'open' } },
  { suffix: 'pending', name: 'Pending Tickets', filter: { statusFilter: 'pending' } },
  { suffix: 'on-hold', name: 'On Hold Tickets', filter: { statusFilter: 'on_hold' } },
  // applyViewFilter treats ids ending in '-unsolved' as "any status except solved".
  { suffix: 'unsolved', name: 'Unsolved Tickets', filter: { statusFilter: 'any' } },
]

/** Slug a department name into a URL-safe id prefix. */
export function deptSlug(deptName: string): string {
  return deptName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Build the row payloads for a department's template views. */
export function templateViewRows(deptName: string) {
  const slug = deptSlug(deptName)
  return TEMPLATES.map((t, idx) => ({
    id: `${slug}-${t.suffix}`,
    name: t.name,
    enabled: true,
    group_name: deptName,
    sort_order: idx,
    filter_config: {
      statusFilter: t.filter.statusFilter,
      assigneeFilter: 'any',
      categoryFilter: 'any',
      slaFilter: 'any',
      ticketTypeFilter: deptName,
    } satisfies ViewFilterConfig,
  }))
}

/** Insert template views for a new department, skipping existing ids. */
export async function seedDepartmentViews(
  supabase: SupabaseClient,
  deptName: string,
): Promise<void> {
  const rows = templateViewRows(deptName)
  const { error } = await supabase
    .from('view_configs')
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
  if (error) throw error
}

/** Update group_name and ticketTypeFilter for views tied to a renamed department. */
export async function renameDepartmentViews(
  supabase: SupabaseClient,
  oldName: string,
  newName: string,
): Promise<void> {
  // Pull existing rows so we can rewrite ids + filter_config (jsonb) atomically.
  const { data, error } = await supabase
    .from('view_configs')
    .select('id, filter_config, sort_order, name, enabled')
    .eq('group_name', oldName)
  if (error) throw error
  if (!data?.length) {
    // Department had no views (legacy). Seed fresh ones under the new name.
    await seedDepartmentViews(supabase, newName)
    return
  }

  const oldSlug = deptSlug(oldName)
  const newSlug = deptSlug(newName)
  const updated = data.map((row) => ({
    id: row.id.startsWith(`${oldSlug}-`)
      ? row.id.replace(`${oldSlug}-`, `${newSlug}-`)
      : row.id,
    name: row.name,
    enabled: row.enabled,
    group_name: newName,
    sort_order: row.sort_order,
    filter_config: {
      ...(row.filter_config as ViewFilterConfig),
      ticketTypeFilter: newName,
    },
  }))

  // Delete the old rows then insert renamed ones (id is the PK and may change).
  const oldIds = data.map((r) => r.id)
  const { error: delErr } = await supabase
    .from('view_configs')
    .delete()
    .in('id', oldIds)
  if (delErr) throw delErr
  const { error: insErr } = await supabase.from('view_configs').insert(updated)
  if (insErr) throw insErr
}

/** Remove all views tied to a deleted department. */
export async function deleteDepartmentViews(
  supabase: SupabaseClient,
  deptName: string,
): Promise<void> {
  const { error } = await supabase
    .from('view_configs')
    .delete()
    .eq('group_name', deptName)
  if (error) throw error
}
