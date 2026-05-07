"use client"

import * as React from "react"
import { ArrowLeft, ArrowRight, Check, Info, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select"
import { MatchPreview } from "./match-preview"
import { ConflictIndicator } from "./conflict-indicator"
import type {
  SlaPolicy,
  SlaPolicyConditions,
  SlaPolicyMetrics,
  TicketType,
  TicketCategory,
  TicketPriority,
} from "@/types/ticket"
import type { SlaFormCatalog, SlaFormValue } from "./sla-form"

// ---------------------------------------------------------------------------
// SlaFormWizard — guided "walk me through it" alternative to SlaForm.
// ---------------------------------------------------------------------------
// Same value shape as SlaForm; admins toggle between modes from the Add
// dialog. Renders one decision at a time with explanatory copy, so admins
// who don't yet have a mental model for SLA matching can build one as they
// go. Steps adapt — the subcategory step skips if no chosen category has
// subcategories defined.
// ---------------------------------------------------------------------------

const PRIORITIES: { value: TicketPriority; label: string }[] = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
]

interface SlaFormWizardProps {
  value: SlaFormValue
  onChange: (next: SlaFormValue) => void
  catalog: SlaFormCatalog
  allPolicies?: SlaPolicy[]
  currentRuleId?: string | null
  /** Called when the wizard finishes the review step. */
  onComplete: () => void
  /** Called when the admin cancels out of the wizard (e.g., closes dialog). */
  onCancel: () => void
}

export function SlaFormWizard({
  value,
  onChange,
  catalog,
  allPolicies,
  currentRuleId = null,
  onComplete,
  onCancel,
}: SlaFormWizardProps) {
  const setName = (name: string) => onChange({ ...value, name })
  const setConditions = (next: SlaPolicyConditions) =>
    onChange({ ...value, conditions: next })
  const setMetrics = (next: SlaPolicyMetrics) =>
    onChange({ ...value, metrics: next })

  // ── Multi-select option lists (mirrors sla-form.tsx) ─────────────────────

  const ticketTypeOptions: MultiSelectOption[] = React.useMemo(
    () => catalog.ticketTypes.map((t) => ({ value: t, label: t })),
    [catalog.ticketTypes],
  )
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
  const subcategoryOptions: MultiSelectOption[] = React.useMemo(() => {
    const cats =
      value.conditions.categories === "any" ? [] : value.conditions.categories
    const opts: MultiSelectOption[] = []
    for (const c of cats) {
      const subs = catalog.subcategoriesByCategory[c] ?? []
      for (const s of subs) opts.push({ value: s, label: s, group: c })
    }
    return opts
  }, [value.conditions.categories, catalog])
  const priorityOptions: MultiSelectOption[] = React.useMemo(
    () => PRIORITIES.map((p) => ({ value: p.value, label: p.label })),
    [],
  )

  const ticketTypesValue =
    value.conditions.ticketTypes === "any"
      ? []
      : value.conditions.ticketTypes
  const categoriesValue =
    value.conditions.categories === "any" ? [] : value.conditions.categories
  const subcategoriesValue =
    !value.conditions.subCategories ||
    value.conditions.subCategories === "any"
      ? []
      : value.conditions.subCategories
  const prioritiesValue =
    value.conditions.priorities === "any" ? [] : value.conditions.priorities

  const setTicketTypes = (next: string[]) => {
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
        prunedCategories !== "any" && prunedCategories.length === 0
          ? "any"
          : prunedCategories,
    })
  }
  const setCategories = (next: string[]) => {
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

  // ── Step machinery ───────────────────────────────────────────────────────

  // The subcategory step is conditional — only included if at least one
  // chosen category has subcategories defined.
  const showSubcategoryStep = subcategoryOptions.length > 0

  const steps: WizardStep[] = [
    {
      key: "name",
      label: "Name",
      title: "Give your rule a name",
      copy: "Pick a name your team will recognize. You can rename later. Examples: 'IT Support — urgent fast track', 'Lending — 8h response'.",
      canAdvance: () => value.name.trim().length > 0,
      render: () => (
        <div>
          <Label className="mb-1.5 text-xs text-muted-foreground">Rule name</Label>
          <Input
            value={value.name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Lending — 8h response"
            autoFocus
          />
        </div>
      ),
    },
    {
      key: "types",
      label: "Types",
      title: "Which ticket types does this apply to?",
      copy: "A ticket type is the broad department the ticket belongs to (Lending Support, IT Support, etc.). Pick one or more, or leave empty to match all types.",
      canAdvance: () => true,
      render: () => (
        <MultiSelect
          options={ticketTypeOptions}
          value={ticketTypesValue}
          onChange={setTicketTypes}
          placeholder="Any ticket type"
        />
      ),
      footer:
        ticketTypesValue.length === 0
          ? "Empty → applies to ALL ticket types."
          : `Limits to ${ticketTypesValue.join(", ")}.`,
    },
    {
      key: "categories",
      label: "Categories",
      title: "Which categories?",
      copy: "Categories are subdivisions inside a ticket type (e.g., 'Income Opinion' under Lending Support). Only categories from the types you picked are shown.",
      canAdvance: () => true,
      render: () => (
        <MultiSelect
          options={categoryOptions}
          value={categoriesValue}
          onChange={setCategories}
          placeholder="Any category"
          disabled={categoryOptions.length === 0}
        />
      ),
      footer:
        categoryOptions.length === 0
          ? "Pick a ticket type on the previous step first."
          : categoriesValue.length === 0
            ? "Empty → applies to ALL categories under those ticket types."
            : `Limits to ${categoriesValue.length} ${categoriesValue.length === 1 ? "category" : "categories"}.`,
    },
    ...(showSubcategoryStep
      ? [
          {
            key: "subcategories" as const,
            label: "Subcategories",
            title: "Pin to specific subcategories? (Optional)",
            copy: "Some categories have subcategories — narrow even further if your SLA only applies to a subset (e.g., 'FHA' under Income Opinion). Skip this step (leave empty) to cover all subcategories of the chosen categories.",
            canAdvance: () => true,
            render: () => (
              <MultiSelect
                options={subcategoryOptions}
                value={subcategoriesValue}
                onChange={setSubCategories}
                placeholder="Any subcategory"
              />
            ),
            footer:
              subcategoriesValue.length === 0
                ? "Empty → applies to ALL subcategories. Recommended unless you know you need this filter."
                : `Tickets without a subcategory set will NOT match this rule.`,
          },
        ]
      : []),
    {
      key: "priorities",
      label: "Priorities",
      title: "Which priorities?",
      copy: "Pick one or more priorities, or leave empty for all. Note: you can also set different response times by priority on the next step instead of using this filter.",
      canAdvance: () => true,
      render: () => (
        <MultiSelect
          options={priorityOptions}
          value={prioritiesValue}
          onChange={setPriorities}
          placeholder="Any priority"
        />
      ),
      footer:
        prioritiesValue.length === 0
          ? "Empty → applies to ALL priorities."
          : `Limits to ${prioritiesValue.length} ${prioritiesValue.length === 1 ? "priority" : "priorities"}.`,
    },
    {
      key: "response",
      label: "Response time",
      title: "How fast does someone need to respond?",
      copy: "Set the first-reply window (from ticket creation) and the next-reply window (resets after each end-user follow-up). You can disable either one if your rule should only track the other.",
      canAdvance: () =>
        value.metrics.firstReplyHours != null ||
        value.metrics.nextReplyHours != null,
      canAdvanceMessage:
        "At least one of First reply or Next reply must be enabled — a rule with both off doesn't track anything.",
      render: () => <ResponseStep value={value} onChange={onChange} />,
    },
    {
      key: "review",
      label: "Review",
      title: "Looks good?",
      copy: "Quick sanity check. The match preview below tells you how many open tickets this rule will start tracking the moment you save. Heads-up callouts surface if your scope overlaps another rule.",
      canAdvance: () => value.name.trim().length > 0,
      render: () => (
        <div className="space-y-3">
          <ReviewSummary value={value} />
          <MatchPreview conditions={value.conditions} />
          {allPolicies && (
            <ConflictIndicator
              conditions={value.conditions}
              policies={allPolicies}
              currentRuleId={currentRuleId}
            />
          )}
        </div>
      ),
    },
  ]

  // ── Active step ──────────────────────────────────────────────────────────

  const [activeIdx, setActiveIdx] = React.useState(0)

  // Clamp activeIdx if subcategory step appearance changed (e.g., admin
  // backed up and removed all categories, hiding the subcategory step).
  React.useEffect(() => {
    if (activeIdx >= steps.length) setActiveIdx(steps.length - 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps.length])

  const step = steps[activeIdx]
  const isLast = activeIdx === steps.length - 1
  const isFirst = activeIdx === 0
  const canAdvance = step.canAdvance()

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Step pills */}
      <div className="flex flex-wrap items-center gap-1">
        {steps.map((s, i) => {
          const done = i < activeIdx
          const active = i === activeIdx
          return (
            <React.Fragment key={s.key}>
              <button
                type="button"
                onClick={() => i <= activeIdx && setActiveIdx(i)}
                disabled={i > activeIdx}
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : done
                      ? "bg-muted text-foreground hover:bg-muted/70"
                      : "bg-muted/40 text-muted-foreground"
                }`}
              >
                {done && <Check className="size-3" />}
                {s.label}
              </button>
              {i < steps.length - 1 && (
                <span className="text-muted-foreground">›</span>
              )}
            </React.Fragment>
          )
        })}
      </div>

      {/* Active step */}
      <div className="space-y-3 rounded-lg border border-input p-4">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold">{step.title}</h4>
            <p className="mt-1 text-xs text-muted-foreground">{step.copy}</p>
          </div>
        </div>

        <div>{step.render()}</div>

        {step.footer && (
          <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <Info className="mt-0.5 size-3 shrink-0" />
            {step.footer}
          </p>
        )}

        {!canAdvance && step.canAdvanceMessage && (
          <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
            {step.canAdvanceMessage}
          </p>
        )}
      </div>

      {/* Nav */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={isFirst ? onCancel : () => setActiveIdx(activeIdx - 1)}
        >
          <ArrowLeft className="mr-1.5 size-4" />
          {isFirst ? "Cancel" : "Back"}
        </Button>
        <span className="text-xs text-muted-foreground">
          Step {activeIdx + 1} of {steps.length}
        </span>
        <Button
          onClick={isLast ? onComplete : () => setActiveIdx(activeIdx + 1)}
          disabled={!canAdvance}
        >
          {isLast ? (
            <>
              <Check className="mr-1.5 size-4" />
              Save rule
            </>
          ) : (
            <>
              Next
              <ArrowRight className="ml-1.5 size-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

interface WizardStep {
  key: string
  label: string
  title: string
  copy: string
  render: () => React.ReactNode
  canAdvance: () => boolean
  canAdvanceMessage?: string
  footer?: string
}

// ---------------------------------------------------------------------------

function ResponseStep({
  value,
  onChange,
}: {
  value: SlaFormValue
  onChange: (next: SlaFormValue) => void
}) {
  const setMetrics = (next: SlaPolicyMetrics) =>
    onChange({ ...value, metrics: next })

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <HoursToggle
          label="First reply within"
          hint="Counts down from ticket creation."
          value={value.metrics.firstReplyHours ?? null}
          onChange={(hours) =>
            setMetrics({ ...value.metrics, firstReplyHours: hours })
          }
        />
        <HoursToggle
          label="Next reply within"
          hint="Resets after each end-user follow-up."
          value={value.metrics.nextReplyHours ?? null}
          onChange={(hours) =>
            setMetrics({ ...value.metrics, nextReplyHours: hours })
          }
        />
      </div>
      <div>
        <Label className="mb-1.5 text-xs text-muted-foreground">
          Warn at (% of window)
        </Label>
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
        <p className="mt-1 text-[11px] text-muted-foreground">
          Tickets cross into &quot;at risk&quot; (amber) at this percentage
          of the response window.
        </p>
      </div>
      <p className="rounded bg-muted/40 px-2 py-1.5 text-[11px] text-muted-foreground">
        Need different times per priority? You can configure per-priority
        overrides in standard mode after saving.
      </p>
    </div>
  )
}

function HoursToggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: number | null
  onChange: (next: number | null) => void
}) {
  const isOff = value === null
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <Switch
          checked={!isOff}
          onCheckedChange={(checked) => onChange(checked ? 4 : null)}
        />
      </div>
      <Input
        type="number"
        min={1}
        step={1}
        className="w-full"
        disabled={isOff}
        value={isOff ? "" : value}
        onChange={(e) => {
          const n = Number(e.target.value)
          onChange(isNaN(n) || n <= 0 ? null : n)
        }}
        placeholder={isOff ? "Off" : "hours"}
      />
      <p className="mt-1 text-[11px] text-muted-foreground">
        {isOff ? "Off — not tracked." : hint}
      </p>
    </div>
  )
}

function ReviewSummary({ value }: { value: SlaFormValue }) {
  const cond = value.conditions
  const types =
    cond.ticketTypes === "any" ? "Any type" : cond.ticketTypes.join(", ")
  const cats =
    cond.categories === "any" ? "Any category" : cond.categories.join(", ")
  const subs =
    !cond.subCategories || cond.subCategories === "any"
      ? null
      : cond.subCategories.join(", ")
  const pris =
    cond.priorities === "any" ? "Any priority" : cond.priorities.join(", ")

  return (
    <div className="space-y-2 rounded-lg border border-input bg-muted/30 p-3 text-xs">
      <div>
        <span className="font-semibold">Name:</span> {value.name || "(unnamed)"}
      </div>
      <div className="space-y-0.5">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-semibold">Scope:</span>
          <Badge variant="outline" className="text-[10px]">{types}</Badge>
          <Badge variant="outline" className="text-[10px]">{cats}</Badge>
          {subs && (
            <Badge variant="outline" className="text-[10px]">
              Sub: {subs}
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px]">{pris}</Badge>
        </div>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span>
          <span className="font-semibold">First reply:</span>{" "}
          {value.metrics.firstReplyHours == null
            ? "Off"
            : `${value.metrics.firstReplyHours}h`}
        </span>
        <span>
          <span className="font-semibold">Next reply:</span>{" "}
          {value.metrics.nextReplyHours == null
            ? "Off"
            : `${value.metrics.nextReplyHours}h`}
        </span>
        <span>
          <span className="font-semibold">Warn at:</span>{" "}
          {value.metrics.warningThreshold ?? 75}%
        </span>
      </div>
    </div>
  )
}
