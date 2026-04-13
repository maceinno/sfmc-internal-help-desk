'use client'

import Link from 'next/link'
import {
  Inbox,
  Clock,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface StatCard {
  label: string
  value: number
  icon: LucideIcon
  color: string
  trend: string
  href: string
}

interface StatsCardsProps {
  newCount: number
  openCount: number
  pendingCount: number
  atRiskCount: number
  breachedCount: number
}

export function StatsCards({
  newCount,
  openCount,
  pendingCount,
  atRiskCount,
  breachedCount,
}: StatsCardsProps) {
  const cards: StatCard[] = [
    {
      label: 'New Tickets',
      value: newCount,
      icon: Inbox,
      color: 'bg-yellow-50 text-yellow-600',
      trend: 'Awaiting triage',
      href: '/tickets?status=new',
    },
    {
      label: 'Open',
      value: openCount,
      icon: Clock,
      color: 'bg-red-50 text-red-600',
      trend: 'Active now',
      href: '/tickets?status=open',
    },
    {
      label: 'Pending',
      value: pendingCount,
      icon: CheckCircle,
      color: 'bg-blue-50 text-blue-600',
      trend: 'Awaiting response',
      href: '/tickets?status=pending',
    },
    {
      label: 'At Risk',
      value: atRiskCount,
      icon: AlertCircle,
      color: 'bg-amber-50 text-amber-600',
      trend: 'Approaching SLA',
      href: '/tickets?sla=at-risk',
    },
    {
      label: 'SLA Breached',
      value: breachedCount,
      icon: AlertTriangle,
      color: 'bg-red-50 text-red-600',
      trend: 'Action needed',
      href: '/tickets?sla=breached',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
      {cards.map((card) => (
        <Link
          key={card.label}
          href={card.href}
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 transition-all cursor-pointer hover:shadow-md hover:border-gray-200 active:scale-[0.98]"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">{card.label}</p>
              <p
                className={`text-3xl font-bold mt-2 ${
                  card.label === 'SLA Breached' && card.value > 0
                    ? 'text-red-600'
                    : 'text-gray-900'
                }`}
              >
                {card.value}
              </p>
            </div>
            <div className={`p-3 rounded-lg ${card.color}`}>
              <card.icon className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <span
              className={`${
                card.label === 'SLA Breached' ? 'text-red-600' : 'text-green-600'
              } font-medium`}
            >
              {card.trend}
            </span>
            <ArrowRight className="w-4 h-4 text-gray-400" />
          </div>
        </Link>
      ))}
    </div>
  )
}
