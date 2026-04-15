'use client'

import { useState, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Trash2,
  Save,
  Settings,
  Loader2,
  Clock,
  CalendarOff,
} from 'lucide-react'
import { toast } from 'sonner'
import { useDepartmentSchedules } from '@/hooks/use-admin-config'
import { createClerkSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import type {
  DepartmentSchedule,
  BusinessHoursEntry,
  DayOfWeek,
} from '@/types'

// ── Constants ──────────────────────────────────────────────────

const US_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
]

const DAYS_OF_WEEK: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

const DEFAULT_BUSINESS_HOURS: BusinessHoursEntry[] = DAYS_OF_WEEK.map(
  (day) => ({
    day,
    enabled: !['saturday', 'sunday'].includes(day),
    startTime: '08:00',
    endTime: '17:00',
  })
)

// ── Page component ─────────────────────────────────────────────

export default function SchedulesAdminPage() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const { data: schedules = [], isLoading } = useDepartmentSchedules()

  const [localSchedules, setLocalSchedules] = useState<
    DepartmentSchedule[] | null
  >(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [saving, setSaving] = useState(false)

  // Holiday form state (per-schedule)
  const [newHolidayName, setNewHolidayName] = useState('')
  const [newHolidayDate, setNewHolidayDate] = useState('')

  // New schedule form state
  const [newDeptName, setNewDeptName] = useState('')
  const [newTimezone, setNewTimezone] = useState('America/New_York')

  const data = localSchedules ?? schedules
  const hasChanges = localSchedules !== null

  // ── Mutation helpers ───────────────────────────────────────

  const updateSchedules = useCallback(
    (updater: (prev: DepartmentSchedule[]) => DepartmentSchedule[]) => {
      setLocalSchedules((prev) => updater(prev ?? schedules))
    },
    [schedules]
  )

  const toggleSchedule = (id: string) => {
    updateSchedules((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    )
  }

  const updateBusinessHours = (
    scheduleId: string,
    day: DayOfWeek,
    field: keyof BusinessHoursEntry,
    value: string | boolean
  ) => {
    updateSchedules((prev) =>
      prev.map((s) => {
        if (s.id !== scheduleId) return s
        return {
          ...s,
          business_hours: s.business_hours.map((bh) =>
            bh.day === day ? { ...bh, [field]: value } : bh
          ),
        }
      })
    )
  }

  const addHoliday = (scheduleId: string) => {
    if (!newHolidayName.trim() || !newHolidayDate) return
    updateSchedules((prev) =>
      prev.map((s) => {
        if (s.id !== scheduleId) return s
        return {
          ...s,
          holidays: [
            ...s.holidays,
            {
              id: `h-${Date.now()}`,
              name: newHolidayName.trim(),
              date: newHolidayDate,
            },
          ].sort((a, b) => a.date.localeCompare(b.date)),
        }
      })
    )
    setNewHolidayName('')
    setNewHolidayDate('')
  }

  const removeHoliday = (scheduleId: string, holidayId: string) => {
    updateSchedules((prev) =>
      prev.map((s) => {
        if (s.id !== scheduleId) return s
        return {
          ...s,
          holidays: s.holidays.filter((h) => h.id !== holidayId),
        }
      })
    )
  }

  const addSchedule = () => {
    if (!newDeptName.trim()) return
    const newSchedule: DepartmentSchedule = {
      id: `sched-${Date.now()}`,
      department_name: newDeptName.trim(),
      timezone: newTimezone,
      business_hours: [...DEFAULT_BUSINESS_HOURS],
      holidays: [],
      enabled: true,
    }
    updateSchedules((prev) => [...prev, newSchedule])
    setNewDeptName('')
    setNewTimezone('America/New_York')
    setShowAddDialog(false)
  }

  const deleteSchedule = (id: string) => {
    updateSchedules((prev) => prev.filter((s) => s.id !== id))
    if (editingId === id) setEditingId(null)
  }

  const handleSave = async () => {
    if (!localSchedules) return
    setSaving(true)
    try {
      const token = await getToken({ template: 'supabase' })
      if (!token) throw new Error('No auth token')
      const supabase = createClerkSupabaseClient(token)

      const { error } = await supabase.from('department_schedules').upsert(
        localSchedules.map((s) => ({
          id: s.id,
          department_name: s.department_name,
          timezone: s.timezone,
          business_hours: s.business_hours,
          holidays: s.holidays,
          enabled: s.enabled,
        }))
      )
      if (error) throw error

      // Delete removed schedules
      const currentIds = new Set(localSchedules.map((s) => s.id))
      const removedIds = schedules
        .filter((s) => !currentIds.has(s.id))
        .map((s) => s.id)
      if (removedIds.length > 0) {
        const { error: delError } = await supabase
          .from('department_schedules')
          .delete()
          .in('id', removedIds)
        if (delError) throw delError
      }

      await queryClient.invalidateQueries({
        queryKey: ['admin', 'departmentSchedules'],
      })
      setLocalSchedules(null)
      toast.success('Department schedules saved')
    } catch (err) {
      console.error('Failed to save schedules:', err)
      toast.error('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    setLocalSchedules(null)
    setEditingId(null)
  }

  // ── Loading state ──────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm font-medium">Loading schedules...</p>
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Unsaved changes bar */}
      {hasChanges && (
        <div className="flex items-center justify-between px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <span className="flex items-center gap-2">
            <Settings className="w-4 h-4 flex-shrink-0" />
            You have unsaved changes.
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDiscard}>
              Discard
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              ) : (
                <Save className="w-3.5 h-3.5 mr-1.5" />
              )}
              Save Changes
            </Button>
          </div>
        </div>
      )}

      {/* Schedule cards */}
      {data.map((schedule) => {
        const isEditing = editingId === schedule.id
        return (
          <Card key={schedule.id}>
            <CardHeader className="border-b bg-gray-50/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={schedule.enabled}
                    onCheckedChange={() => toggleSchedule(schedule.id)}
                    size="sm"
                  />
                  <div>
                    <CardTitle>{schedule.department_name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {schedule.timezone}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant={isEditing ? 'secondary' : 'ghost'}
                    size="icon-sm"
                    onClick={() =>
                      setEditingId(isEditing ? null : schedule.id)
                    }
                    title="Edit schedule"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => deleteSchedule(schedule.id)}
                    title="Delete schedule"
                    className="text-gray-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            {isEditing && (
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Business Hours */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-500" />
                      Business Hours
                    </h3>

                    {/* Timezone */}
                    <div className="mb-4">
                      <Label className="text-xs text-muted-foreground mb-1.5">
                        Timezone
                      </Label>
                      <select
                        value={schedule.timezone}
                        onChange={(e) =>
                          updateSchedules((prev) =>
                            prev.map((s) =>
                              s.id === schedule.id
                                ? { ...s, timezone: e.target.value }
                                : s
                            )
                          )
                        }
                        className="w-full h-8 px-2.5 text-sm border border-input rounded-lg bg-transparent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
                      >
                        {US_TIMEZONES.map((tz) => (
                          <option key={tz} value={tz}>
                            {tz.replace('_', ' ')}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-3">
                      {schedule.business_hours.map((bh) => (
                        <div key={bh.day} className="flex items-center gap-3">
                          <div className="w-24">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={bh.enabled}
                                onChange={(e) =>
                                  updateBusinessHours(
                                    schedule.id,
                                    bh.day,
                                    'enabled',
                                    e.target.checked
                                  )
                                }
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm font-medium text-gray-700 capitalize">
                                {bh.day.slice(0, 3)}
                              </span>
                            </label>
                          </div>
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="time"
                              value={bh.startTime}
                              onChange={(e) =>
                                updateBusinessHours(
                                  schedule.id,
                                  bh.day,
                                  'startTime',
                                  e.target.value
                                )
                              }
                              disabled={!bh.enabled}
                              className="px-2 py-1 text-sm border border-input rounded-lg focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none disabled:opacity-50 disabled:bg-gray-50"
                            />
                            <span className="text-muted-foreground text-sm">
                              to
                            </span>
                            <input
                              type="time"
                              value={bh.endTime}
                              onChange={(e) =>
                                updateBusinessHours(
                                  schedule.id,
                                  bh.day,
                                  'endTime',
                                  e.target.value
                                )
                              }
                              disabled={!bh.enabled}
                              className="px-2 py-1 text-sm border border-input rounded-lg focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none disabled:opacity-50 disabled:bg-gray-50"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Holidays */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <CalendarOff className="w-4 h-4 text-amber-500" />
                      Holidays
                    </h3>

                    {/* Add holiday form */}
                    <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 mb-4">
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <Label className="text-xs text-muted-foreground mb-1">
                            Holiday Name
                          </Label>
                          <Input
                            value={newHolidayName}
                            onChange={(e) => setNewHolidayName(e.target.value)}
                            placeholder="e.g. New Year's Day"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1">
                            Date
                          </Label>
                          <Input
                            type="date"
                            value={newHolidayDate}
                            onChange={(e) => setNewHolidayDate(e.target.value)}
                          />
                        </div>
                        <Button
                          size="sm"
                          onClick={() => addHoliday(schedule.id)}
                          disabled={!newHolidayName.trim() || !newHolidayDate}
                        >
                          Add
                        </Button>
                      </div>
                    </div>

                    {/* Holiday list */}
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {schedule.holidays.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No holidays configured.
                        </p>
                      ) : (
                        schedule.holidays.map((holiday) => (
                          <div
                            key={holiday.id}
                            className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded-lg"
                          >
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {holiday.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(holiday.date).toLocaleDateString(
                                  undefined,
                                  {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    timeZone: 'UTC',
                                  }
                                )}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() =>
                                removeHoliday(schedule.id, holiday.id)
                              }
                              className="text-gray-400 hover:text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        )
      })}

      {data.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No department schedules configured yet.
        </div>
      )}

      {/* Add new schedule */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogTrigger
          render={
            <Button
              variant="outline"
              className="w-full border-2 border-dashed"
            />
          }
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Department Schedule
        </DialogTrigger>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New Department Schedule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5">
                Department Name
              </Label>
              <Input
                value={newDeptName}
                onChange={(e) => setNewDeptName(e.target.value)}
                placeholder="e.g. Closing Support"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5">
                Timezone
              </Label>
              <select
                value={newTimezone}
                onChange={(e) => setNewTimezone(e.target.value)}
                className="w-full h-8 px-2.5 text-sm border border-input rounded-lg bg-transparent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
              >
                {US_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={addSchedule} disabled={!newDeptName.trim()}>
              <Plus className="w-4 h-4 mr-1.5" />
              Add Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
