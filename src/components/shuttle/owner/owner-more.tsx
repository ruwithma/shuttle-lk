'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Receipt, Bell, FileBarChart, ChevronRight, MapPin } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import ExpenseTracking from '@/components/shuttle/owner/expense-tracking'
import NotificationPanel from '@/components/shuttle/shared/notification-panel'
import FleetTracking from '@/components/shuttle/owner/fleet-tracking'
import OwnerReports from '@/components/shuttle/owner/reports'

type MoreView = 'menu' | 'expenses' | 'notifications' | 'reports' | 'fleet-tracking'

export default function OwnerMore() {
  const { notifications } = useAppStore()
  const [view, setView] = useState<MoreView>('menu')
  const unreadCount = notifications.filter((n) => !n.read).length

  if (view === 'expenses') return <ExpenseTracking />
  if (view === 'notifications') return <NotificationPanel />
  if (view === 'fleet-tracking') return <FleetTracking />
  if (view === 'reports') {
    return <OwnerReports onBack={() => setView('menu')} />
  }

  const menuItems = [
    {
      id: 'fleet-tracking' as MoreView,
      icon: MapPin,
      label: 'Fleet Tracking',
      description: 'Track all buses in real-time',
      color: 'bg-emerald-50 text-emerald-600',
    },
    {
      id: 'expenses' as MoreView,
      icon: Receipt,
      label: 'Expenses',
      description: 'Track and manage expenses',
      color: 'bg-red-50 text-red-600',
    },
    {
      id: 'notifications' as MoreView,
      icon: Bell,
      label: 'Notifications',
      description: unreadCount > 0 ? `${unreadCount} unread` : 'All caught up',
      color: 'bg-amber-50 text-amber-600',
    },
    {
      id: 'reports' as MoreView,
      icon: FileBarChart,
      label: 'Reports',
      description: 'View financial reports',
      color: 'bg-purple-50 text-purple-600',
    },
  ]

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold text-gray-900">More</h2>
      <div className="space-y-2">
        {menuItems.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card
              className="rounded-2xl border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => {
                  setView(item.id)
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.color.split(' ')[0]}`}>
                      <item.icon className={`w-5 h-5 ${item.color.split(' ')[1]}`} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
