'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Ticket,
  PlusCircle,
  Layers,
  BarChart3,
  Settings,
  PlaneTakeoff,
  AlertTriangle,
  AtSign,
  Bell,
  Menu,
  X,
  MapPin,
  Building2,
  LogOut,
  Sparkles,
} from 'lucide-react'
import { useClerk } from '@clerk/nextjs'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useBranding } from '@/hooks/use-admin-config'
import { useNotifications } from '@/hooks/use-notifications'
import { useUIStore } from '@/stores/ui-store'
import { useNotificationStore } from '@/stores/notification-store'
import { NotificationPanel } from './notification-panel'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

export function Sidebar() {
  const pathname = usePathname()
  const { profile, isAdmin, isAgent, isEmployee, isRealAdmin, isAssuming, isLoading } = useCurrentUser()
  const { data: branding } = useBranding()
  const { data: notifications = [] } = useNotifications()
  const { mobileMenuOpen, setMobileMenuOpen } = useUIStore()
  const { panelOpen: notifOpen, togglePanel: toggleNotifs } = useNotificationStore()
  const { signOut } = useClerk()
  const queryClient = useQueryClient()
  const [showOooConfirm, setShowOooConfirm] = useState(false)
  const [oooLoading, setOooLoading] = useState(false)

  const unreadCount = notifications.filter((n) => !n.read).length
  const isAgentOrAdmin = isAgent || isAdmin

  // Close mobile sidebar on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setMobileMenuOpen(false)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [setMobileMenuOpen])

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileMenuOpen])

  // Build nav items based on role. While the profile is still loading, show
  // an empty list so we never flash the agent/admin nav to an employee
  // before their role resolves (or vice versa).
  const navItems: NavItem[] = isLoading || !profile
    ? []
    : isEmployee
      ? [
          { href: '/tickets/new', label: 'Create Ticket', icon: PlusCircle },
          { href: '/my-tickets', label: 'My Tickets', icon: Ticket },
          { href: '/cc-tickets', label: "CC'd Tickets", icon: AtSign },
          ...(profile?.has_branch_access ? [{ href: '/branch', label: 'My Branch', icon: Building2 }] : []),
          ...(profile?.has_regional_access ? [{ href: '/region', label: 'My Region', icon: MapPin }] : []),
          { href: '/whats-new', label: "What's New", icon: Sparkles },
        ]
      : [
          { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { href: '/tickets', label: 'Agent Views', icon: Layers },
          { href: '/my-tickets', label: 'My Tickets', icon: Ticket },
          { href: '/cc-tickets', label: "CC'd Tickets", icon: AtSign },
          { href: '/reports', label: 'Reports', icon: BarChart3 },
          { href: '/tickets/new', label: 'Create Ticket', icon: PlusCircle },
          { href: '/whats-new', label: "What's New", icon: Sparkles },
        ]

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    if (href === '/tickets') return pathname === '/tickets'
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-slate-950 border-b border-slate-800/50 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="text-sm font-semibold text-white">
          {(branding?.company_name as string) ?? 'SFMC Help Desk'}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setMobileMenuOpen(true); setTimeout(() => toggleNotifs(), 100) }}
            className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors relative"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />}
          </button>
        </div>
      </div>

      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`h-screen w-64 bg-slate-950 text-white flex flex-col fixed left-0 top-0 z-50 shadow-xl transition-transform duration-300 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        {/* Brand */}
        <div className="px-5 py-5 border-b border-slate-800/50 flex items-center justify-between">
          <div className="flex-1">
            {branding?.logo_url ? (
              <div
                className="rounded-lg p-2 mx-auto w-fit"
                style={{
                  backgroundColor:
                    (branding.logo_background as string) === 'white'
                      ? '#ffffff'
                      : (branding.logo_background as string) === 'custom'
                        ? (branding.logo_background_color as string) ?? 'transparent'
                        : 'transparent',
                }}
              >
                <img
                  src={branding.logo_url as string}
                  alt={(branding.logo_alt as string) ?? 'Logo'}
                  className="h-10 w-auto object-contain mx-auto"
                />
              </div>
            ) : (
              <div className="text-lg font-bold text-white text-center">
                {(branding?.company_name as string) ?? 'SFMC Help Desk'}
              </div>
            )}
            <div className="text-[11px] text-slate-400 font-medium tracking-wide uppercase mt-1 text-center">
              {(branding?.portal_subtitle as string) ?? 'Internal Support Portal'}
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors ml-2 -mr-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                  active
                    ? 'bg-amber-700/90 text-white shadow-md'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <item.icon className={`w-5 h-5 ${active ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                <span className="font-medium">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Notifications */}
        <div className="px-4 pb-2 relative">
          <NotificationPanel />
          <button
            data-notification-toggle
            onClick={toggleNotifs}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 ${
              notifOpen ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />}
              </div>
              <span className="font-medium">Notifications</span>
            </div>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Out of Office + User Profile */}
        <div className="border-t border-slate-800/50 bg-slate-950">
          {/* OOO Toggle (agents/admins only) */}
          {isAgentOrAdmin && (
            <div className="px-4 pt-3">
              {profile?.is_out_of_office && (
                <div className="mb-2 flex items-center gap-2 rounded-lg bg-amber-600/20 border border-amber-500/30 px-3 py-2">
                  <PlaneTakeoff className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-medium text-amber-300">Out of Office is ON</span>
                </div>
              )}
              {!showOooConfirm ? (
                <button
                  onClick={() => setShowOooConfirm(true)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all border border-transparent ${
                    profile?.is_out_of_office
                      ? 'text-amber-400 hover:bg-slate-800'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <PlaneTakeoff className="w-4 h-4" />
                    <span className="font-medium">
                      {profile?.is_out_of_office ? 'Disable Out of Office' : 'Out of Office'}
                    </span>
                  </div>
                </button>
              ) : (
                <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                  <div className="flex items-start gap-2 mb-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-white">
                        {profile?.is_out_of_office ? 'Disable Out of Office?' : 'Enable Out of Office?'}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                        {profile?.is_out_of_office
                          ? 'You will be available for new ticket assignments again.'
                          : 'New tickets will route to your team but skip you. Your current tickets stay assigned to you.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={oooLoading}
                      onClick={async () => {
                        setOooLoading(true)
                        try {
                          const res = await fetch('/api/users/ooo', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ enabled: !profile?.is_out_of_office }),
                          })
                          if (!res.ok) throw new Error('Failed')
                          queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] })
                          queryClient.invalidateQueries({ queryKey: ['tickets'] })
                          toast.success(profile?.is_out_of_office ? 'Out of Office disabled' : 'Out of Office enabled')
                        } catch {
                          toast.error('Failed to toggle Out of Office')
                        } finally {
                          setOooLoading(false)
                          setShowOooConfirm(false)
                        }
                      }}
                      className="flex-1 px-3 py-1.5 text-xs font-medium bg-amber-600 text-white rounded-md hover:bg-amber-500 transition-colors disabled:opacity-50"
                    >
                      {oooLoading ? 'Updating...' : 'Yes, confirm'}
                    </button>
                    <button
                      onClick={() => setShowOooConfirm(false)}
                      className="flex-1 px-3 py-1.5 text-xs font-medium bg-slate-700 text-slate-300 rounded-md hover:bg-slate-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* User Profile */}
          <div className="p-4">
            <div className="flex items-center space-x-3 p-2 rounded-lg">
              <Link
                href="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex-shrink-0"
              >
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.name}
                    className="w-10 h-10 rounded-full border-2 border-slate-700 object-cover hover:border-slate-500 transition-colors"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full border-2 border-slate-700 bg-slate-700 flex items-center justify-center text-sm font-semibold text-white hover:border-slate-500 transition-colors">
                    {profile?.name?.charAt(0)?.toUpperCase() ?? '?'}
                  </div>
                )}
              </Link>
              <Link
                href="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex-1 min-w-0 hover:opacity-80 transition-opacity"
              >
                <p className="text-sm font-medium text-white truncate">{profile?.name ?? 'Loading...'}</p>
                <p className="text-xs text-slate-400 truncate capitalize">{profile?.role ?? ''}</p>
              </Link>
              <div className="flex items-center gap-1">
                {(isAdmin || isRealAdmin) && (
                  <Link
                    href="/admin/views"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`p-1.5 rounded-md transition-colors ${
                      pathname.startsWith('/admin')
                        ? 'bg-amber-700/90 text-white'
                        : 'text-slate-500 hover:text-white hover:bg-slate-700'
                    }`}
                    title="Admin Settings"
                  >
                    <Settings className="w-4 h-4" />
                  </Link>
                )}
                <button
                  onClick={() => signOut({ redirectUrl: '/sign-in' })}
                  className="p-1.5 rounded-md transition-colors text-slate-500 hover:text-red-400 hover:bg-slate-700"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
