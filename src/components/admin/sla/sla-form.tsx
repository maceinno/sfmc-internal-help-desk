"use client"

import * as React from "react"
import { Info, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select"
import type {
  SlaPolicy,
  SlaPolicyConditions,
  SlaPolicyMetrics,
  SlaPolicyPerPriorityMetrics,
  TicketType,
  TicketCategory,
  TicketPriority,
} from "@/types/ticket"

// ---------------------------------------------------------------------------
// SlaForm — cascading admin form for creating/editing SLA rules.
// ---------------------------------------------------------------------------
// Used by both the "Add SLA" dialog and the per-row inline editor on the
// admin page. State lives in the parent (controlled component) so the page
// can swap between list/edit modes and so wizard mode can share state with
// the standard form (see sla-form-wizard.tsx, M6).
//
// Cascading guardrails:
//   - Categories are scoped to whichever ticket types are selected.
//     Picking "Lending Support" first hides "IT Systems" from the Categories
//     picker. Empty types = show all categories from all types.
//   - Subcategories are scoped to whichever categories are selected, grouped
//     by source category. Hidden entirely if no chosen category has any
//     subcategories defined. (Wired in M3.)
//   - Empty-set semantics are explicit in the help copy: "Leave empty to
//     match ALL". The previous bug came from a hidden field silently
//     filtering rules; loud "empty = all" copy kills that footgun.
// ---------------------------------------------------------------------------

const PRIORITIES: { value: TicketPriority; label: string }[] = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
]

export interface SlaFormValue {
  name: string
  conditions: SlaPolicyConditions
  metrics: SlaPolicyMetrics
}

export interface SlaFormCatalog {
  /** Available ticket types. */
  ticketTypes: TicketType[]
  /** ticket type → categories under that type. */
  categoriesByType: Record<string, string[]>
  /** category → subcategories under that category (for M3). */
  subcategoriesByCategory: Record<string, string[]>
}

export interface SlaFormProps {
  value: SlaFormValue
  onChange: (next: SlaFormValue) => void
  catalog: SlaFormCatalog
  /** Hide the rule-name field (used by the inline-editor variant where the
   *  name is edited via a separate Input above the form). */
  hideName?: boolean
}

// ---------------------------------------------------------------------------

export function SlaForm({
  value,
  onChange,
  catalog,
  hideName = false,
}: SlaFormProps) {
  const setName = (name: string) => onChange({ ...value, name })

  const setConditions = (next: SlaPolicyConditions) =>
    onChange({ ...value, conditions: next })

  const setMetrics = (next: SlaPolicyMetrics) =>
    onChange({ ...value, metrics: next })

  // ── Multi-select option lists ────────────────────────────────────────────

  const ticketTypeOptions: MultiSelectOption[] = React.useMemo(
    () => catalog.ticketTypes.map((t) => ({ value: t, label: t })),
    [catalog.ticketTypes],
  )

  // Scope categories to chosen ticket types. If none chosen, show all.
  const categoryOptions: MultiSelectOption[] = React.useMemo(() => {
    const types =
      value.conditions.ticketTypes === "any"
        ? catalog.ticketTypes
        : value.conditions.ticketTypes
    const set = new Set<string>()
    for (const t of types) {
      for (const c of catalog.categoriesByType[t] ?? []) set.add(c)
    }
    return Array.from(set)
      .sort()
      .map((c) => ({ value: c, label: c }))
  }, [value.conditions.ticketTypes, catalog])

  const priorityOptions: MultiSelectOption[] = React.useMemo(
    () => PRIORITIES.map((p) => ({ value: p.value, label: p.label })),
    [],
  )

  // Subcategory options: union across selected categories, grouped by
  // source category so admins see which subcategory belongs to which.
  const subcategoryOptions: MultiSelectOption[] = React.useMemo(() => {
    const cats =
      value.conditions.categories === "any" ? [] : value.conditions.categories
    const opts: MultiSelectOption[] = []
    for (const c of cats) {
      const subs = catalog.subcategoriesByCategory[c] ?? []
      for (const s of subs) {
        opts.push({ value: s, label: s, group: c })
      }
    }
    return opts
  }, [value.conditions.categories, catalog])

  const subcategoriesValue: string[] =
    !value.conditions.subCategories || value.conditions.subCategories === "any"
      ? []
      : value.conditions.subCategories

  // Detect the "subcategories from cat A but not cat B" mismatch.
  // Surface as a warning in the form footer so admins can see + fix it.
  const subcategoryMismatch = React.useMemo(() => {
    if (subcategoriesValue.length === 0) return null
    if (value.conditions.categories === "any") return null
    const groupsWithSelection = new Set<string>()
    for (const opt of subcategoryOptions) {
      if (subcategoriesValue.includes(opt.value) && opt.group) {
        groupsWithSelection.add(opt.group)
      }
    }
    const categoriesWithoutPicks = value.conditions.categories.filter(
      (c) => !groupsWithSelection.has(c),
    )
    if (categoriesWithoutPicks.length === 0) return null
    return categoriesWithoutPicks
  }, [subcategoriesValue, subcategoryOptions, value.conditions.categories])

  // ── Helpers ──────────────────────────────────────────────────────────────

  const ticketTypesValue: string[] =
    value.conditions.ticketTypes === "any"
      ? []
      : value.conditions.ticketTypes
  const categoriesValue: string[] =
    value.conditions.categories === "any" ? [] : value.conditions.categories
  const prioritiesValue: string[] =
    value.conditions.priorities === "any" ? [] : value.conditions.priorities

  const setTicketTypes = (next: string[]) => {
    // When ticket types change, drop any categories no longer reachable.
    const allowed = new Set<string>(
      next.length === 0
        ? Object.values(catalog.categoriesByType).flat()
        : next.flatMap((t) => catalog.categoriesByType[t] ?? []),
    )
    const prunedCategories =
      value.conditions.categories === "any"
        ? "any"
        : (value.conditions.categories.filter((c) =>
            allowed.has(c),
          ) as TicketCategory[])
    setConditions({
      ...value.conditions,
      ticketTypes: next.length === 0 ? "any" : (next as TicketType[]),
      categories:
        prunedCategories === "any" || prunedCategories.length === 0
          ? value.conditions.categories === "any"
            ? "any"
            : "any" // empty after pruning means "any" again
          : prunedCategories,
    })
  }

  const setCategories = (next: string[]) => {
    // Drop subcategories no longer reachable from the new category set.
    const allowedSubs = new Set<string>(
      next.flatMap((c) => catalog.subcategoriesByCategory[c] ?? []),
    )
    const currentSubs = value.conditions.subCategories
    const prunedSubs =
      !currentSubs || currentSubs === "any"
        ? currentSubs
        : currentSubs.filter((s) => allowedSubs.has(s))
    setConditions({
      ...value.conditions,
      categories: next.length === 0 ? "any" : (next as TicketCategory[]),
      subCategories:
        prunedSubs === undefined
          ? undefined
          : prunedSubs === "any"
            ? "any"
            : prunedSubs.length === 0
              ? undefined
              : prunedSubs,
    })
  }

  const setSubCategories = (next: string[]) =>
    setConditions({
      ...value.conditions,
      subCategories: next.length === 0 ? undefined : next,
    })

  const setPriorities = (next: string[]) =>
    setConditions({
      ...value.conditions,
      priorities: next.length === 0 ? "any" : (next as TicketPriority[]),
    })

  return (
    <div className="space-y-5">
      {!hideName && (
        <div>
          <Label className="mb-1.5 text-xs text-muted-foreground">
            Rule name
          </Label>
          <Input
            value={value.name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Lending Support — 8h response"
          />
        </div>
      )}

      <Section
        title="Scope"
        helper="Which tickets does this rule apply to? Leave any picker empty to mean 'match anything'."
      >
        <Field
          label="Ticket types"
          helper={
            ticketTypesValue.length === 0
              ? "Empty: applies to all ticket types."
              : `Limits to ${ticketTypesValue.length === 1 ? "this type" : "these types"} only.`
          }
        >
          <MultiSelect
            options={ticketTypeOptions}
            value={ticketTypesValue}
            onChange={setTicketTypes}
            placeholder="Any ticket type"
            searchPlaceholder="Search types…"
          />
        </Field>

        <Field
          label="Categories"
          helper={
            categoryOptions.length === 0
              ? "No categories available — pick a ticket type first."
              : categoriesValue.length === 0
                ? "Empty: applies to all categories under the selected ticket type(s)."
                : `Limits to ${categoriesValue.length} ${categoriesValue.length === 1 ? "category" : "categories"}.`
          }
        >
          <MultiSelect
            options={categoryOptions}
            value={categoriesValue}
            onChange={setCategories}
            placeholder="Any category"
            searchPlaceholder="Search categories…"
            disabled={categoryOptions.length === 0}
          />
        </Field>

        {subcategoryOptions.length > 0 && (
          <Field
            label="Subcategories (optional)"
            helper={
              subcategoriesValue.length === 0
                ? "Empty: applies to ALL subcategories of the selected categories."
                : `Limits to ${subcategoriesValue.length} ${subcategoriesValue.length === 1 ? "subcategory" : "subcategories"}. Tickets without a subcategory set will NOT match.`
            }
          >
            <MultiSelect
              options={subcategoryOptions}
              value={subcategoriesValue}
              onChange={setSubCategories}
              placeholder="Any subcategory"
              searchPlaceholder="Search subcategories…"
            />
            {subcategoryMismatch && subcategoryMismatch.length > 0 && (
              <div className="mt-2 flex items-start gap-2 rounded border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <div>
                  <strong>Heads up:</strong> you picked subcategories from
                  some chosen categories but not from{" "}
                  {subcategoryMismatch.map((c, i) => (
                    <React.Fragment key={c}>
                      {i > 0 && (i === subcategoryMismatch.length - 1 ? " or " : ", ")}
                      <span className="font-mono">{c}</span>
                    </React.Fragment>
                  ))}
                  . Tickets in those categories won&apos;t match this rule.
                  Either add subcategories from those categories, or remove
                  the categories from this rule&apos;s scope.
                </div>
              </div>
            )}
          </Field>
        )}

        <Field
          label="Priorities"
          helper={
            prioritiesValue.length === 0
              ? "Empty: applies to all priorities."
              : `Limits to ${prioritiesValue.length} ${prioritiesValue.length === 1 ? "priority" : "priorities"}.`
          }
        >
          <MultiSelect
            options={priorityOptions}
            value={prioritiesValue}
            onChange={setPriorities}
            placeholder="Any priority"
            searchPlaceholder="Search priorities…"
          />
        </Field>
      </Section>

      <Section
        title="Response time"
        helper="How fast does someone need to respond? Hours are calendar-clock unless a department schedule is configured."
      >
        <div className="grid grid-cols-2 gap-3">
          <HoursField
            label="First reply within"
            value={value.metrics.firstReplyHours ?? null}
            onChange={(hours) =>
              setMetrics({ ...value.metrics, firstReplyHours: hours })
            }
            offHelper="Off — first-reply tracking disabled."
            onHelper="Counts down from ticket creation."
          />
          <HoursField
            label="Next reply within"
            value={value.metrics.nextReplyHours ?? null}
            onChange={(hours) =>
              setMetrics({ ...value.metrics, nextReplyHours: hours })
            }
            offHelper="Off — next-reply tracking disabled."
            onHelper="Resets after each end-user follow-up."
          />
        </div>

        <PerPriorityOverrides
          metrics={value.metrics}
          onChange={(perPriority) =>
            setMetrics({ ...value.metrics, perPriority })
          }
        />

        <Field
          label="Warn at"
          helper="Tickets cross into 'at risk' (amber) at this percentage of the response window."
        >
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={99}
              className="w-24"
              value={value.metrics.warningThreshold ?? 75}
              onChange={(e) =>
                setMetrics({
                  ...value.metrics,
                  warningThreshold: Number(e.target.value),
                })
              }
            />
            <span className="text-sm text-muted-foreground">% of the window</span>
          </div>
        </Field>
      </Section>
    </div>
  )
}

// ---------------------------------------------------------------------------

function PerPriorityOverrides({
  metrics,
  onChange,
}: {
  metrics: SlaPolicyMetrics
  onChange: (
    next:
      | Partial<Record<TicketPriority, SlaPolicyPerPriorityMetrics>>
      | undefined,
  ) => void
}) {
  const enabled = metrics.perPriority !== undefined
  const overrides = metrics.perPriority ?? {}

  const setForPriority = (
    priority: TicketPriority,
    patch: Partial<SlaPolicyPerPriorityMetrics>,
  ) => {
    const current = overrides[priority] ?? {}
    const merged = { ...current, ...patch }
    // If both fields are now undefined, drop the entry entirely.
    if (
      merged.firstReplyHours === undefined &&
      merged.nextReplyHours === undefined
    ) {
      const { [priority]: _drop, ...rest } = overrides
      void _drop
      onChange(Object.keys(rest).length === 0 ? undefined : rest)
      return
    }
    onChange({ ...overrides, [priority]: merged })
  }

  const toggle = (checked: boolean) => {
    onChange(checked ? {} : undefined)
  }

  return (
    <div className="rounded border border-input bg-background p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">
            Different response times by priority
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            When on, urgent tickets can have a faster response window than
            medium/low. Empty cells fall back to the top-level value above.
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={toggle} />
      </div>

      {enabled && (
        <div className="mt-3 overflow-hidden rounded border border-input">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">Priority</th>
                <th className="px-2 py-1.5 text-left font-medium">First reply (hrs)</th>
                <th className="px-2 py-1.5 text-left font-medium">Next reply (hrs)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-input">
              {PRIORITIES.map((p) => {
                const entry = overrides[p.value] ?? {}
                return (
                  <tr key={p.value}>
                    <td className="px-2 py-1.5 font-medium capitalize">
                      {p.label}
                    </td>
                    <td className="px-2 py-1.5">
                      <PerPriorityCell
                        value={entry.firstReplyHours}
                        fallback={metrics.firstReplyHours}
                        onChange={(next) =>
                          setForPriority(p.value, { firstReplyHours: next })
                        }
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <PerPriorityCell
                        value={entry.nextReplyHours}
                        fallback={metrics.nextReplyHours}
                        onChange={(next) =>
                          setForPriority(p.value, { nextReplyHours: next })
                        }
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function PerPriorityCell({
  value,
  fallback,
  onChange,
}: {
  /** undefined = no override at this priority (use fallback). */
  value: number | null | undefined
  fallback: number | null
  onChange: (next: number | null | undefined) => void
}) {
  const [mode, setMode] = React.useState<"fallback" | "off" | "set">(() =>
    value === undefined ? "fallback" : value === null ? "off" : "set",
  )

  // Sync mode when the parent value changes (e.g. switching policies).
  React.useEffect(() => {
    setMode(value === undefined ? "fallback" : value === null ? "off" : "set")
  }, [value])

  return (
    <div className="flex items-center gap-2">
      <select
        value={mode}
        onChange={(e) => {
          const next = e.target.value as "fallback" | "off" | "set"
          setMode(next)
          if (next === "fallback") onChange(undefined)
          else if (next === "off") onChange(null)
          else onChange(typeof value === "number" ? value : (fallback ?? 4))
        }}
        className="h-7 rounded border border-input bg-transparent px-1.5 text-xs"
      >
        <option value="fallback">
          Use default ({fallback === null ? "off" : `${fallback}h`})
        </option>
        <option value="off">Off at this priority</option>
        <option value="set">Custom…</option>
      </select>
      {mode === "set" && (
        <Input
          type="number"
          min={1}
          step={1}
          value={typeof value === "number" ? value : ""}
          onChange={(e) => {
            const n = Number(e.target.value)
            onChange(isNaN(n) || n <= 0 ? (fallback ?? 1) : n)
          }}
          className="h-7 w-16 text-xs"
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function Section({
  title,
  helper,
  children,
}: {
  title: string
  helper: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-3 rounded-lg border border-input p-4">
      <div className="flex items-start gap-2">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="flex-1">
          <h4 className="text-sm font-semibold">{title}</h4>
          <p className="text-xs text-muted-foreground">{helper}</p>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Field({
  label,
  helper,
  children,
}: {
  label: string
  helper?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <Label className="mb-1.5 text-xs text-muted-foreground">{label}</Label>
      {children}
      {helper && <p className="mt-1 text-[11px] text-muted-foreground">{helper}</p>}
    </div>
  )
}

function HoursField({
  label,
  value,
  onChange,
  offHelper,
  onHelper,
}: {
  label: string
  value: number | null
  onChange: (next: number | null) => void
  offHelper: string
  onHelper: string
}) {
  const isOff = value === null
  return (
    <div>
      <Label className="mb-1.5 text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={1}
          step={1}
          className={cn("w-24", isOff && "opacity-50")}
          value={isOff ? "" : value}
          disabled={isOff}
          onChange={(e) => {
            const n = Number(e.target.value)
            onChange(isNaN(n) || n <= 0 ? null : n)
          }}
        />
        <span className="text-sm text-muted-foreground">hours</span>
        <div className="ml-auto flex items-center gap-2">
          <Switch
            checked={!isOff}
            onCheckedChange={(checked) => onChange(checked ? 4 : null)}
          />
          <span className="text-xs text-muted-foreground">
            {isOff ? "Off" : "On"}
          </span>
        </div>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {isOff ? offHelper : onHelper}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helper to build a SlaFormCatalog from useDepartmentCategories() output.
// Kept here so the page only has to call one helper.
// ---------------------------------------------------------------------------

export function buildSlaFormCatalog(
  departmentGroups: {
    ticket_type: string
    categories: { name: string; subCategories?: string[] }[]
  }[],
): SlaFormCatalog {
  const ticketTypes: TicketType[] = []
  const categoriesByType: Record<string, string[]> = {}
  const subcategoriesByCategory: Record<string, string[]> = {}
  for (const g of departmentGroups) {
    ticketTypes.push(g.ticket_type as TicketType)
    categoriesByType[g.ticket_type] = g.categories.map((c) => c.name)
    for (const c of g.categories) {
      if (c.subCategories?.length) {
        subcategoriesByCategory[c.name] = c.subCategories
      }
    }
  }
  return { ticketTypes, categoriesByType, subcategoriesByCategory }
}

