'use client'

import {
  LayoutDashboard,
  Bus,
  Users,
  CreditCard,
  MoreHorizontal,
  HandCoins,
  History,
  Route,
  Search,
  Radio,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import type { UserRole } from '@/lib/types'
import { motion } from 'framer-motion'

interface TabConfig {
  id: string
  label: string
  icon: React.ElementType
  roles: UserRole[]
}

const TABS: TabConfig[] = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard, roles: ['OWNER', 'DRIVER', 'STUDENT'] },
  { id: 'find', label: 'Find', icon: Search, roles: ['STUDENT'] },
  { id: 'fleet-tracking', label: 'Fleet', icon: Radio, roles: ['OWNER'] },
  { id: 'buses', label: 'Buses', icon: Bus, roles: ['OWNER'] },
  { id: 'payments', label: 'Payments', icon: CreditCard, roles: ['OWNER', 'STUDENT'] },
  { id: 'collect', label: 'Collect', icon: HandCoins, roles: ['DRIVER'] },
  { id: 'record-route', label: 'Route', icon: Route, roles: ['DRIVER'] },
  { id: 'driver-history', label: 'History', icon: History, roles: ['DRIVER'] },
  { id: 'route', label: 'Track', icon: Route, roles: ['STUDENT'] },
  { id: 'more', label: 'More', icon: MoreHorizontal, roles: ['OWNER', 'DRIVER', 'STUDENT'] },
]

export default function BottomNav() {
  const { currentUser, activeTab, setActiveTab, notifications } = useAppStore()
  if (!currentUser) return null

  const role = currentUser.role as UserRole
  const visibleTabs = TABS.filter((tab) => tab.roles.includes(role))
  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-lg border-t border-gray-200 dark:border-gray-700 z-50 safe-area-bottom">
      <div className="max-w-lg mx-auto flex items-center justify-around">
        {visibleTabs.map((tab) => {
          const isActive = activeTab === tab.id
          const Icon = tab.icon
          const showBadge = tab.id === 'more' && unreadCount > 0

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex flex-col items-center justify-center py-1.5 px-2 min-w-[52px] relative"
            >
              <div className="relative p-1">
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute -inset-1.5 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <Icon
                  className={`w-5 h-5 relative z-10 transition-colors ${
                    isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'
                  }`}
                />
                {showBadge && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center z-20">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] mt-0.5 font-medium transition-colors ${
                  isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
