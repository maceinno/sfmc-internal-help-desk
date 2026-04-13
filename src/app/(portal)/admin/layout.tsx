'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Settings } from 'lucide-react'

const ADMIN_TABS = [
  { label: 'Views', href: '/admin/views' },
  { label: 'SLA Policies', href: '/admin/sla' },
  { label: 'Schedules', href: '/admin/schedules' },
  { label: 'Canned Responses', href: '/admin/canned-responses' },
  { label: 'Users', href: '/admin/users' },
  { label: 'Routing', href: '/admin/routing' },
  { label: 'Categories', href: '/admin/categories' },
  { label: 'Custom Fields', href: '/admin/custom-fields' },
  { label: 'Branding', href: '/admin/branding' },
  { label: 'Import', href: '/admin/import' },
] as const

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-900 rounded-lg">
            <Settings className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Admin Settings
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Manage system configuration and policies
            </p>
          </div>
        </div>
      </div>

      {/* Horizontal scrollable tab bar */}
      <div className="overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0">
        <div className="flex gap-1 border-b border-gray-200 min-w-max">
          {ADMIN_TABS.map((tab) => {
            const isActive = pathname === tab.href
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Page content */}
      <div className="mt-8">{children}</div>
    </div>
  )
}
