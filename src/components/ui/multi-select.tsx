"use client"

import * as React from "react"
import { X, ChevronsUpDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"

// ---------------------------------------------------------------------------
// MultiSelect — Popover + Command (cmdk) with checkboxes and removable chips.
// ---------------------------------------------------------------------------
// Generic over option value (string keyed). Supports flat options or grouping
// by `group` field. Used by the SLA admin form for ticket-types, categories,
// subcategories, and priorities.
// ---------------------------------------------------------------------------

export interface MultiSelectOption {
  value: string
  label: string
  /** Optional group label — when set, options are rendered under group headers. */
  group?: string
}

interface MultiSelectProps {
  options: MultiSelectOption[]
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  /** Optional className for the trigger button. */
  className?: string
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyMessage = "No matches.",
  disabled = false,
  className,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false)

  const selectedOptions = React.useMemo(
    () => options.filter((o) => value.includes(o.value)),
    [options, value],
  )

  // Group options by their `group` field if any are grouped.
  const groupedOptions = React.useMemo(() => {
    const hasGroups = options.some((o) => o.group)
    if (!hasGroups) {
      return [{ name: undefined as string | undefined, items: options }]
    }
    const map = new Map<string | undefined, MultiSelectOption[]>()
    for (const opt of options) {
      const key = opt.group
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(opt)
    }
    return Array.from(map.entries()).map(([name, items]) => ({ name, items }))
  }, [options])

  const toggle = (optValue: string) => {
    if (value.includes(optValue)) {
      onChange(value.filter((v) => v !== optValue))
    } else {
      onChange([...value, optValue])
    }
  }

  const removeChip = (e: React.MouseEvent, optValue: string) => {
    e.stopPropagation()
    onChange(value.filter((v) => v !== optValue))
  }

  return (
    <div className="flex flex-col gap-1.5">
      {/* Selected chips */}
      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedOptions.map((opt) => (
            <Badge
              key={opt.value}
              variant="secondary"
              className="gap-1 pr-1"
            >
              <span className="max-w-[140px] truncate">{opt.label}</span>
              {!disabled && (
                <button
                  type="button"
                  className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                  onClick={(e) => removeChip(e, opt.value)}
                  aria-label={`Remove ${opt.label}`}
                >
                  <X className="size-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          disabled={disabled}
          className={cn(
            "flex h-8 w-full items-center justify-between rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors hover:bg-muted",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            "disabled:pointer-events-none disabled:opacity-50",
            !selectedOptions.length && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">
            {selectedOptions.length === 0
              ? placeholder
              : `${selectedOptions.length} selected`}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </PopoverTrigger>

        <PopoverContent
          className="w-[var(--anchor-width)] p-0"
          align="start"
        >
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              {groupedOptions.map((group) => (
                <CommandGroup key={group.name ?? "_default"} heading={group.name}>
                  {group.items.map((opt) => {
                    const isSelected = value.includes(opt.value)
                    return (
                      <CommandItem
                        key={opt.value}
                        value={opt.label}
                        onSelect={() => toggle(opt.value)}
                        data-checked={isSelected ? "true" : undefined}
                        className="gap-2"
                      >
                        <span
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded border",
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input",
                          )}
                        >
                          {isSelected && <Check className="size-3" />}
                        </span>
                        <span className="flex-1 truncate">{opt.label}</span>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
