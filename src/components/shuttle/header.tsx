'use client'

import { Bell, LogOut } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { UserRole } from '@/lib/types'

const roleConfig: Record<UserRole, { label: string; className: string }> = {
  OWNER: { label: 'Owner', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  DRIVER: { label: 'Driver', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  STUDENT: { label: 'Student', className: 'bg-teal-100 text-teal-700 border-teal-200' },
}

export default function Header() {
  const { currentUser, notifications, setActiveTab, logout, isDriverLive } = useAppStore()
  if (!currentUser) return null

  const unreadCount = notifications.filter((n) => !n.read).length
  const initials = currentUser.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const role = currentUser.role as UserRole
  const roleInfo = roleConfig[role]

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-lg mx-auto flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <AnimatePresence>
              {isDriverLive && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"
                >
                  <motion.span
                    className="absolute inset-0 rounded-full bg-red-500"
                    animate={{ scale: [1, 2.5], opacity: [0.7, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                  />
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">ShuttleLK</h1>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={() => setActiveTab('notifications')}
          >
            <Bell className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            <AnimatePresence>
              {unreadCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center z-10"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </motion.span>
              )}
            </AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500"
                animate={{ scale: [1, 2], opacity: [0.5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
              />
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-2 py-1.5">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{currentUser.name}</p>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${roleInfo.className}`}>
                    {roleInfo.label}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{currentUser.phone}</p>
              </div>
              <DropdownMenuItem onClick={logout} className="text-red-600 cursor-pointer">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
