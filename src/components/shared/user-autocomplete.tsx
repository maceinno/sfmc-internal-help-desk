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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { User } from "@/types"

interface UserAutocompleteProps {
  users: User[]
  selectedIds: string[]
  onSelect: (userId: string) => void
  onRemove?: (userId: string) => void
  placeholder?: string
  multiple?: boolean
  excludeIds?: string[]
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

const roleBadgeVariant: Record<
  User["role"],
  "default" | "secondary" | "outline"
> = {
  admin: "default",
  agent: "secondary",
  employee: "outline",
}

export function UserAutocomplete({
  users,
  selectedIds,
  onSelect,
  onRemove,
  placeholder = "Select user...",
  multiple = false,
  excludeIds = [],
}: UserAutocompleteProps) {
  const [open, setOpen] = React.useState(false)

  const availableUsers = React.useMemo(
    () => users.filter((u) => !excludeIds.includes(u.id)),
    [users, excludeIds]
  )

  const selectedUsers = React.useMemo(
    () => users.filter((u) => selectedIds.includes(u.id)),
    [users, selectedIds]
  )

  const handleSelect = (userId: string) => {
    if (selectedIds.includes(userId)) {
      onRemove?.(userId)
    } else {
      onSelect(userId)
    }

    if (!multiple) {
      setOpen(false)
    }
  }

  const handleRemoveTag = (
    e: React.MouseEvent,
    userId: string
  ) => {
    e.stopPropagation()
    onRemove?.(userId)
  }

  // Build the trigger label for single-select mode
  const triggerLabel = React.useMemo(() => {
    if (!multiple && selectedUsers.length === 1) {
      return selectedUsers[0].name
    }
    return placeholder
  }, [multiple, selectedUsers, placeholder])

  return (
    <div className="flex flex-col gap-1.5">
      {/* Chips for multiple mode */}
      {multiple && selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedUsers.map((user) => (
            <Badge
              key={user.id}
              variant="secondary"
              className="gap-1 pr-1"
            >
              <span className="max-w-[120px] truncate">{user.name}</span>
              {onRemove && (
                <button
                  type="button"
                  className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                  onClick={(e) => handleRemoveTag(e, user.id)}
                  aria-label={`Remove ${user.name}`}
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
          className={cn(
            "flex h-8 w-full items-center justify-between rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors hover:bg-muted",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            "disabled:pointer-events-none disabled:opacity-50",
            !selectedUsers.length && "text-muted-foreground"
          )}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </PopoverTrigger>

        <PopoverContent
          className="w-[var(--anchor-width)] p-0"
          align="start"
        >
          <Command>
            <CommandInput placeholder="Search by name or email..." />
            <CommandList>
              <CommandEmpty>No users found.</CommandEmpty>
              <CommandGroup>
                {availableUsers.map((user) => {
                  const isSelected = selectedIds.includes(user.id)
                  return (
                    <CommandItem
                      key={user.id}
                      value={`${user.name} ${user.email}`}
                      onSelect={() => handleSelect(user.id)}
                      data-checked={isSelected ? "true" : undefined}
                      className="gap-2.5 py-2"
                    >
                      <Avatar size="sm">
                        {user.avatar && (
                          <AvatarImage
                            src={user.avatar}
                            alt={user.name}
                          />
                        )}
                        <AvatarFallback>
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">
                          {user.name}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {user.email}
                        </span>
                      </div>

                      <Badge
                        variant={roleBadgeVariant[user.role]}
                        className="shrink-0 text-[10px] capitalize"
                      >
                        {user.role}
                      </Badge>

                      {multiple && isSelected && (
                        <Check className="ml-auto size-4 shrink-0 text-primary" />
                      )}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
