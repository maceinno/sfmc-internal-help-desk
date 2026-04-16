'use client'

import { useState, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Loader2,
  Save,
  Camera,
  User as UserIcon,
  Shield,
  Mail,
  Building2,
  Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import { useCurrentUser } from '@/hooks/use-current-user'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const US_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'America/Phoenix', label: 'Arizona (no DST)' },
]

export default function ProfilePage() {
  const { profile, isLoading, user } = useCurrentUser()
  const queryClient = useQueryClient()

  const [name, setName] = useState('')
  const [department, setDepartment] = useState('')
  const [timezone, setTimezone] = useState('America/Chicago')
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (profile) {
      setName(profile.name)
      setDepartment(profile.department ?? '')
      setTimezone(profile.timezone ?? 'America/Chicago')
    }
  }, [profile])

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Name cannot be empty')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/users/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          timezone,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to save')
      }
      queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] })
      toast.success('Profile updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarUpload = async (file: File) => {
    setUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/users/profile/avatar', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Upload failed')
      }
      queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] })
      toast.success('Photo updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload')
    } finally {
      setUploadingAvatar(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!profile) return null

  const initials = profile.name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="pb-6 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="text-gray-500 mt-1">Manage your profile information.</p>
      </div>

      {/* Avatar Card */}
      <Card>
        <CardContent className="flex items-center gap-6 p-6">
          <div className="relative group">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.name}
                className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-slate-200 flex items-center justify-center border-4 border-white shadow-md">
                <span className="text-2xl font-bold text-slate-500">{initials}</span>
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              {uploadingAvatar ? (
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              ) : (
                <Camera className="w-6 h-6 text-white" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleAvatarUpload(file)
                e.target.value = ''
              }}
            />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{profile.name}</h2>
            <p className="text-sm text-gray-500">{profile.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant={profile.role === 'admin' ? 'default' : profile.role === 'agent' ? 'secondary' : 'outline'}>
                {profile.role}
              </Badge>
              {profile.department && (
                <Badge variant="outline">{profile.department}</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Form */}
      <Card>
        <CardHeader className="border-b bg-muted/50">
          <div className="flex items-center gap-2">
            <UserIcon className="size-4 text-muted-foreground" />
            <CardTitle>Profile Details</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="grid gap-1.5">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
            />
          </div>

          <div className="grid gap-1.5">
            <Label className="flex items-center gap-1.5">
              <Mail className="size-3.5 text-muted-foreground" />
              Email
            </Label>
            <Input value={profile.email} disabled />
            <p className="text-xs text-muted-foreground">
              Email cannot be changed. Contact an admin if needed.
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label className="flex items-center gap-1.5">
              <Shield className="size-3.5 text-muted-foreground" />
              Role
            </Label>
            <Input value={profile.role} disabled className="capitalize" />
            <p className="text-xs text-muted-foreground">
              Role is managed by administrators.
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label className="flex items-center gap-1.5">
              <Building2 className="size-3.5 text-muted-foreground" />
              Department
            </Label>
            <Input value={profile.department ?? 'Not assigned'} disabled />
            <p className="text-xs text-muted-foreground">
              Department is managed by administrators.
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label className="flex items-center gap-1.5">
              <Clock className="size-3.5 text-muted-foreground" />
              Timezone
            </Label>
            <Select value={timezone} onValueChange={(val) => { if (val) setTimezone(val) }}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {US_TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Used for SLA calculations and time displays.
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1.5" />
              )}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
