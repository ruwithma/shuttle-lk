'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Bell, BellRing, Check, Info, DollarSign, Megaphone } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import type { Notification, NotificationType } from '@/lib/types'

const typeConfig: Record<NotificationType, { icon: React.ElementType; color: string }> = {
  PAYMENT_REMINDER: { icon: BellRing, color: 'bg-amber-50 text-amber-600' },
  PAYMENT_RECEIVED: { icon: DollarSign, color: 'bg-emerald-50 text-emerald-600' },
  GENERAL: { icon: Info, color: 'bg-blue-50 text-blue-600' },
}

export default function NotificationPanel() {
  const { currentUser, notifications, setNotifications } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [sendingReminders, setSendingReminders] = useState(false)

  useEffect(() => {
    loadNotifications()
  }, [currentUser])

  const loadNotifications = async () => {
    if (!currentUser) return
    setLoading(true)
    try {
      const res = await fetch(`/api/notifications?userId=${currentUser.id}`)
      if (res.ok) {
        const data = await res.json()
        setNotifications(data)
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (notifId: string) => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: notifId }),
      })
      if (res.ok) {
        setNotifications(
          notifications.map((n: Notification) =>
            n.id === notifId ? { ...n, read: true } : n
          )
        )
      }
    } catch {
      // silently fail
    }
  }

  const markAllRead = async () => {
    try {
      const unreadIds = notifications.filter((n: Notification) => !n.read).map((n: Notification) => n.id)
      for (const id of unreadIds) {
        await markAsRead(id)
      }
      toast({ title: 'Done', description: 'All notifications marked as read' })
    } catch {
      // silently fail
    }
  }

  const handleSendReminders = async () => {
    setSendingReminders(true)
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send-reminders', ownerId: currentUser?.id }),
      })
      if (res.ok) {
        toast({ title: 'Reminders Sent', description: 'Payment reminders sent to all unpaid students' })
        loadNotifications()
      } else {
        toast({ title: 'Error', description: 'Failed to send reminders', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' })
    } finally {
      setSendingReminders(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    )
  }

  const unreadCount = notifications.filter((n: Notification) => !n.read).length

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">
          Notifications
          {unreadCount > 0 && (
            <Badge className="ml-2 bg-red-500 text-white text-[10px]">{unreadCount}</Badge>
          )}
        </h2>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead} className="rounded-xl text-xs h-8">
              <Check className="w-3 h-3 mr-1" />
              Mark all read
            </Button>
          )}
          {currentUser?.role === 'OWNER' && (
            <Button
              size="sm"
              onClick={handleSendReminders}
              disabled={sendingReminders}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs h-8"
            >
              <Megaphone className="w-3 h-3 mr-1" />
              Send Reminders
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto">
        {notifications.length > 0 ? (
          notifications.map((notif: Notification, index: number) => {
            const config = typeConfig[notif.type] || typeConfig.GENERAL
            const Icon = config.icon
            return (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card
                  className={`rounded-xl border-0 shadow-sm cursor-pointer transition-all ${
                    notif.read ? 'bg-white' : 'bg-emerald-50/50 border-l-4 border-l-emerald-500'
                  }`}
                  onClick={() => !notif.read && markAsRead(notif.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${config.color.split(' ')[0]}`}>
                        <Icon className={`w-4 h-4 ${config.color.split(' ')[1]}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`text-sm font-medium ${notif.read ? 'text-gray-700' : 'text-gray-900'}`}>
                            {notif.title}
                          </p>
                          {!notif.read && (
                            <div className="w-2 h-2 bg-emerald-500 rounded-full shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {notif.message}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {notif.createdAt ? format(new Date(notif.createdAt), 'MMM d, h:mm a') : ''}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })
        ) : (
          <div className="text-center py-12">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No notifications yet</p>
          </div>
        )}
      </div>
    </div>
  )
}
