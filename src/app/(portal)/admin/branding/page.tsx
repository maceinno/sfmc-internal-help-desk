'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClerkSupabaseClient } from '@/lib/supabase/client'
import { useBranding, type BrandingConfig } from '@/hooks/use-admin-config'
import { toast } from 'sonner'
import {
  Save,
  RefreshCw,
  Eye,
  Image,
  Type,
  Palette,
  Loader2,
  Check,
  Upload,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

// ── Defaults ────────────────────────────────────────────────────

interface BrandingForm {
  companyName: string
  portalSubtitle: string
  logoUrl: string
  logoAlt: string
  logoBackground: 'white' | 'transparent' | 'custom'
  logoBackgroundColor: string
  primaryColor: string
  accentColor: string
}

const DEFAULT_BRANDING: BrandingForm = {
  companyName: 'SFMC Home Lending',
  portalSubtitle: 'Internal Support Portal',
  logoUrl: '',
  logoAlt: 'SFMC Home Lending',
  logoBackground: 'white',
  logoBackgroundColor: '#1e293b',
  primaryColor: '#2563eb',
  accentColor: '#7c3aed',
}

function configToForm(config: BrandingConfig | null): BrandingForm {
  if (!config) return { ...DEFAULT_BRANDING }
  // DB returns snake_case columns
  return {
    companyName: (config.company_name as string) ?? DEFAULT_BRANDING.companyName,
    portalSubtitle:
      (config.portal_subtitle as string) ?? DEFAULT_BRANDING.portalSubtitle,
    logoUrl: (config.logo_url as string) ?? '',
    logoAlt: (config.logo_alt as string) ?? DEFAULT_BRANDING.logoAlt,
    logoBackground:
      (config.logo_background as BrandingForm['logoBackground']) ??
      DEFAULT_BRANDING.logoBackground,
    logoBackgroundColor:
      (config.logo_background_color as string) ??
      DEFAULT_BRANDING.logoBackgroundColor,
    primaryColor:
      (config.primary_color as string) ?? DEFAULT_BRANDING.primaryColor,
    accentColor:
      (config.accent_color as string) ?? DEFAULT_BRANDING.accentColor,
  }
}

// ── Page ────────────────────────────────────────────────────────

export default function BrandingPage() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const { data: branding, isLoading } = useBranding()

  const [form, setForm] = useState<BrandingForm>({ ...DEFAULT_BRANDING })
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  // Sync form when data loads
  useEffect(() => {
    if (branding !== undefined) {
      setForm(configToForm(branding))
    }
  }, [branding])

  const update = useCallback(
    (patch: Partial<BrandingForm>) => setForm((prev) => ({ ...prev, ...patch })),
    [],
  )

  const handleLogoUpload = useCallback(
    async (file: File) => {
      const ALLOWED = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
      if (!ALLOWED.includes(file.type)) {
        toast.error('Logo must be PNG, JPG, SVG, or WEBP')
        return
      }
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Logo must be under 2 MB')
        return
      }

      setUploading(true)
      try {
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch('/api/upload/branding', {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error ?? 'Upload failed')
        }

        const data = await res.json()
        const altText = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
        update({ logoUrl: data.url, logoAlt: altText })
        toast.success('Logo uploaded')
      } catch (err) {
        toast.error('Failed to upload logo')
        console.error(err)
      } finally {
        setUploading(false)
      }
    },
    [update],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files?.[0]
      if (file) handleLogoUpload(file)
    },
    [handleLogoUpload],
  )

  // ── Mutation ──────────────────────────────────────────────

  const saveBranding = useMutation({
    mutationFn: async (data: BrandingForm) => {
      const token = await getToken({ template: 'supabase' })
      if (!token) throw new Error('No auth token')
      const supabase = createClerkSupabaseClient(token)

      const payload = {
        company_name: data.companyName,
        portal_subtitle: data.portalSubtitle,
        logo_url: data.logoUrl,
        logo_alt: data.logoAlt,
        logo_background: data.logoBackground,
        logo_background_color: data.logoBackgroundColor,
        primary_color: data.primaryColor,
        accent_color: data.accentColor,
      }

      if (branding?.id) {
        const { error } = await supabase
          .from('branding_config')
          .update(payload)
          .eq('id', branding.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('branding_config').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'branding'] })
      toast.success('Branding settings saved')
    },
    onError: () => {
      toast.error('Failed to save branding settings')
    },
  })

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
      <div>
        <h1 className="text-lg font-semibold">Branding</h1>
        <p className="text-sm text-muted-foreground">
          Customize the look and feel of the portal.
        </p>
      </div>

      {/* ── Live Preview ─────────────────────────────────── */}
      <Card>
        <CardHeader className="border-b bg-muted/50">
          <div className="flex items-center gap-2">
            <Eye className="size-4 text-muted-foreground" />
            <CardTitle>Live Preview</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-8">
            {/* Sidebar mock */}
            <div className="w-64 flex-shrink-0 rounded-xl bg-slate-950 overflow-hidden shadow-lg">
              <div className="border-b border-slate-800/50 px-5 py-5">
                <div
                  className="rounded-lg p-3"
                  style={{
                    backgroundColor:
                      form.logoBackground === 'white'
                        ? '#ffffff'
                        : form.logoBackground === 'custom'
                          ? form.logoBackgroundColor
                          : 'transparent',
                  }}
                >
                  {form.logoUrl ? (
                    <img
                      src={form.logoUrl}
                      alt={form.logoAlt}
                      className="mx-auto h-10 w-auto object-contain"
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="flex h-10 items-center justify-center text-sm text-gray-400">
                      No logo set
                    </div>
                  )}
                </div>
                <div className="mt-3 text-center text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  {form.portalSubtitle || 'Portal Subtitle'}
                </div>
              </div>
              <div className="space-y-1 px-3 py-4">
                <div
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white"
                  style={{ backgroundColor: form.primaryColor }}
                >
                  <div className="size-4 rounded bg-white/20" />
                  Dashboard
                </div>
                <div className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-800/50">
                  <div className="size-4 rounded bg-slate-700" />
                  Tickets
                </div>
                <div className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-800/50">
                  <div className="size-4 rounded bg-slate-700" />
                  Reports
                </div>
              </div>
            </div>

            {/* UI elements preview */}
            <div className="flex-1 space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">
                UI Elements Preview
              </h3>
              <div className="flex flex-wrap gap-3">
                <button
                  className="rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm"
                  style={{ backgroundColor: form.primaryColor }}
                >
                  Primary Button
                </button>
                <button
                  className="rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm"
                  style={{ backgroundColor: form.accentColor }}
                >
                  Accent Button
                </button>
                <button className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700">
                  Secondary Button
                </button>
              </div>
              <div className="flex flex-wrap gap-3">
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium text-white"
                  style={{ backgroundColor: form.primaryColor }}
                >
                  Primary Badge
                </span>
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium text-white"
                  style={{ backgroundColor: form.accentColor }}
                >
                  Accent Badge
                </span>
              </div>
              <a
                href="#"
                className="text-sm font-medium underline"
                style={{ color: form.primaryColor }}
                onClick={(e) => e.preventDefault()}
              >
                Sample link text
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Logo ─────────────────────────────────────────── */}
      <Card>
        <CardHeader className="border-b bg-muted/50">
          <div className="flex items-center gap-2">
            <Image className="size-4 text-muted-foreground" />
            <CardTitle>Logo</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Logo upload / URL */}
          <div>
            <Label>Logo</Label>

            {/* Current logo preview + remove */}
            {form.logoUrl && (
              <div className="mt-2 mb-3 flex items-start gap-3">
                <div className="inline-block rounded-lg border bg-white p-4">
                  <img
                    src={form.logoUrl}
                    alt={form.logoAlt}
                    className="h-12 w-auto object-contain"
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => update({ logoUrl: '', logoAlt: '' })}
                >
                  <X className="size-3.5 mr-1" />
                  Remove
                </Button>
              </div>
            )}

            {/* Drag-and-drop upload zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
                dragOver
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/40'
              }`}
            >
              {uploading ? (
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <Upload className="size-8 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">Drag & drop your logo here</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PNG, JPG, SVG, or WEBP &middot; Max 2 MB
                  </p>
                  <label className="mt-3 cursor-pointer">
                    <span className="text-sm font-medium text-primary hover:underline">
                      Or click to browse
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleLogoUpload(file)
                        e.target.value = ''
                      }}
                    />
                  </label>
                </>
              )}
            </div>

            {/* Or paste URL */}
            <div className="mt-3">
              <p className="text-xs text-muted-foreground mb-1.5">Or paste a URL:</p>
              <Input
                value={form.logoUrl}
                onChange={(e) => update({ logoUrl: e.target.value })}
                placeholder="https://example.com/logo.png"
              />
            </div>
          </div>

          {/* Alt text */}
          <div>
            <Label>Logo Alt Text</Label>
            <Input
              value={form.logoAlt}
              onChange={(e) => update({ logoAlt: e.target.value })}
              placeholder="Company Name"
              className="mt-1.5"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Accessibility text shown when the logo cannot load.
            </p>
          </div>

          {/* Logo background */}
          <div>
            <Label>Logo Background</Label>
            <div className="mt-2 grid grid-cols-3 gap-3">
              {(
                [
                  { value: 'white', label: 'White Box' },
                  { value: 'transparent', label: 'Transparent' },
                  { value: 'custom', label: 'Custom' },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => update({ logoBackground: option.value })}
                  className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                    form.logoBackground === option.value
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'border-border hover:border-muted-foreground/30'
                  }`}
                >
                  <div className="flex h-10 w-full items-center justify-center rounded-lg bg-slate-900">
                    <div
                      className="rounded px-3 py-1"
                      style={{
                        backgroundColor:
                          option.value === 'white'
                            ? '#ffffff'
                            : option.value === 'custom'
                              ? form.logoBackgroundColor
                              : 'transparent',
                      }}
                    >
                      <div
                        className={`h-3 w-12 rounded ${
                          option.value === 'transparent'
                            ? 'bg-slate-400'
                            : option.value === 'custom'
                              ? 'bg-white/30'
                              : 'bg-gray-300'
                        }`}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-medium">{option.label}</span>
                  {form.logoBackground === option.value && (
                    <div className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-primary">
                      <Check className="size-3 text-primary-foreground" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            {form.logoBackground === 'custom' && (
              <div className="mt-3 flex items-center gap-3">
                <input
                  type="color"
                  value={form.logoBackgroundColor}
                  onChange={(e) =>
                    update({ logoBackgroundColor: e.target.value })
                  }
                  className="h-10 w-10 cursor-pointer rounded-lg border p-0.5"
                />
                <Input
                  value={form.logoBackgroundColor}
                  onChange={(e) =>
                    update({ logoBackgroundColor: e.target.value })
                  }
                  placeholder="#1e293b"
                  className="font-mono"
                />
              </div>
            )}

            <p className="mt-2 text-xs text-muted-foreground">
              Choose &quot;Transparent&quot; if your logo is designed for dark
              backgrounds.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Company Info ─────────────────────────────────── */}
      <Card>
        <CardHeader className="border-b bg-muted/50">
          <div className="flex items-center gap-2">
            <Type className="size-4 text-muted-foreground" />
            <CardTitle>Company Info</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Company Name</Label>
            <Input
              value={form.companyName}
              onChange={(e) => update({ companyName: e.target.value })}
              placeholder="Your Company Name"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Portal Subtitle</Label>
            <Input
              value={form.portalSubtitle}
              onChange={(e) => update({ portalSubtitle: e.target.value })}
              placeholder="Internal Support Portal"
              className="mt-1.5"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Shown below the logo in the sidebar.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Brand Colors ─────────────────────────────────── */}
      <Card>
        <CardHeader className="border-b bg-muted/50">
          <div className="flex items-center gap-2">
            <Palette className="size-4 text-muted-foreground" />
            <CardTitle>Brand Colors</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <Label>Primary Color</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Used for buttons, active states, and links.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.primaryColor}
                  onChange={(e) => update({ primaryColor: e.target.value })}
                  className="h-10 w-10 cursor-pointer rounded-lg border p-0.5"
                />
                <Input
                  value={form.primaryColor}
                  onChange={(e) => update({ primaryColor: e.target.value })}
                  placeholder="#2563eb"
                  className="font-mono"
                />
              </div>
            </div>
            <div>
              <Label>Accent Color</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Used for highlights, badges, and secondary actions.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.accentColor}
                  onChange={(e) => update({ accentColor: e.target.value })}
                  className="h-10 w-10 cursor-pointer rounded-lg border p-0.5"
                />
                <Input
                  value={form.accentColor}
                  onChange={(e) => update({ accentColor: e.target.value })}
                  placeholder="#7c3aed"
                  className="font-mono"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Actions ──────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setForm({ ...DEFAULT_BRANDING })}
        >
          <RefreshCw className="size-4 mr-1.5" />
          Reset to Defaults
        </Button>
        <Button
          onClick={() => saveBranding.mutate(form)}
          disabled={saveBranding.isPending}
        >
          {saveBranding.isPending ? (
            <Loader2 className="size-4 mr-1.5 animate-spin" />
          ) : (
            <Save className="size-4 mr-1.5" />
          )}
          Save Branding
        </Button>
      </div>
    </div>
  )
}
