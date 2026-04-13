'use client'

import { useRouter } from 'next/navigation'
import { Bell, AlertTriangle } from 'lucide-react'
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '@/hooks/use-notifications'
import { useNotificationStore } from '@/stores/notification-store'

export function NotificationPanel() {
  const router = useRouter()
  const { data: notifications = [] } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()
  const { panelOpen, setPanelOpen } = useNotificationStore()

  const unreadCount = notifications.filter((n) => !n.read).length

  if (!panelOpen) return null

  return (
    <div className="absolute bottom-full left-4 right-4 mb-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50">
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Notifications</h3>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead.mutate()}
            className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
          >
            Mark all read
          </button>
        )}
      </div>
      <div className="max-h-80 overflow-y-auto">
        {notifications.length > 0 ? (
          <div className="divide-y divide-slate-700">
            {notifications.map((notif) => (
              <button
                key={notif.id}
                onClick={() => {
                  markRead.mutate(notif.id)
                  setPanelOpen(false)
                  router.push(`/tickets/${notif.ticketId}`)
                }}
                className={`w-full text-left p-4 hover:bg-slate-700/50 transition-colors flex gap-3 ${
                  !notif.read ? 'bg-slate-700/20' : ''
                }`}
              >
                <div className="relative flex-shrink-0">
                  {notif.type === 'sla_at_risk' ? (
                    <div className="w-8 h-8 rounded-full border border-amber-500/50 bg-amber-500/20 flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full border border-slate-600 bg-slate-700 flex items-center justify-center">
                      <Bell className="w-4 h-4 text-slate-400" />
                    </div>
                  )}
                  {!notif.read && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-800" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${!notif.read ? 'text-white font-medium' : 'text-slate-300'}`}>
                    {notif.message}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 truncate">{notif.ticketTitle}</p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {new Date(notif.timestamp).toLocaleString()}
                  </p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-slate-500 text-sm">No notifications yet</div>
        )}
      </div>
    </div>
  )
}
