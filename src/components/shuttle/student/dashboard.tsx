'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, AlertCircle, Clock, CreditCard, Bus as BusIcon, MapPin, Radio, Navigation, Search, Sparkles } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { fetchDashboardData, isCacheFresh } from '@/lib/data-fetcher'
import { useBusLocation } from '@/components/shuttle/shared/bus-location-hook'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { formatLKR } from '@/lib/utils'
import type { StudentDashboard as StudentDashboardType } from '@/lib/types'

const statusConfig = {
  PAID: { icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800', badge: 'bg-emerald-600 text-white', label: 'PAID' },
  UNPAID: { icon: AlertCircle, color: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800', badge: 'bg-red-500 text-white', label: 'UNPAID' },
  OVERDUE: { icon: Clock, color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800', badge: 'bg-amber-500 text-white', label: 'OVERDUE' },
}

export default function StudentDashboard() {
  const { currentUser, studentDashboard, setStudentDashboard, setActiveTab } = useAppStore()
  const [loading, setLoading] = useState(!studentDashboard || !isCacheFresh('STUDENT'))
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadDashboard()
  }, [currentUser])

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (!currentUser) return
    if (isRefresh) {
      setRefreshing(true)
    } else if (!studentDashboard || !isCacheFresh('STUDENT')) {
      setLoading(true)
    }
    try {
      const data = await fetchDashboardData<StudentDashboardType>(currentUser.id, 'STUDENT')
      if (data) {
        setStudentDashboard(data)
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [currentUser, setStudentDashboard, studentDashboard])

  const data = studentDashboard || {
    paymentStatus: 'UNPAID' as const,
    nextDueDate: undefined,
    paymentHistory: [],
    subscription: { id: '', studentId: '', busId: '', paymentType: 'MONTHLY' as const, active: false, startDate: '' },
    bus: { id: '', plateNumber: '', name: 'N/A', capacity: 0, routeName: '', routeStart: '', routeEnd: '', routeStops: '', ownerId: '', active: false },
  }

  // Get live bus location for this student's bus
  const { location, isLive } = useBusLocation(data.bus?.id || null)

  const status = statusConfig[data.paymentStatus]
  const StatusIcon = status.icon

  const totalPaidThisMonth = data.paymentHistory
    .filter((p) => {
      const d = new Date(p.date)
      const now = new Date()
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((sum, p) => sum + p.amount, 0)

  const greeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  // Calculate route progress (0-100) based on where bus is on its route
  const routeProgress = useMemo(() => {
    if (!isLive || !location || !data.bus?.routeCoordinates) return 0
    try {
      const coords = JSON.parse(data.bus.routeCoordinates || '[]')
      if (!Array.isArray(coords) || coords.length < 2) return 0

      // Find closest point on route
      let closestIdx = 0
      let closestDist = Infinity
      for (let i = 0; i < coords.length; i++) {
        const d = Math.sqrt(
          Math.pow(coords[i][0] - location.lat, 2) +
          Math.pow(coords[i][1] - location.lng, 2)
        )
        if (d < closestDist) {
          closestDist = d
          closestIdx = i
        }
      }
      return Math.round((closestIdx / (coords.length - 1)) * 100)
    } catch {
      return 0
    }
  }, [isLive, location, data.bus?.routeCoordinates])

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse w-48" />
        <div className="h-32 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
        <div className="h-24 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {/* Welcome */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          {greeting()}, {currentUser?.name?.split(' ')[0]}!
        </h2>
      </motion.div>

      {/* Live Bus Status - Uber-style card */}
      {isLive && location && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 }}>
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 text-white overflow-hidden relative">
            {/* Decorative background circles */}
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full" />
            <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-white/5 rounded-full" />
            <CardContent className="p-5 relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    <span className="text-sm font-bold text-emerald-100 uppercase tracking-wider">Your bus is live</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black">{location.speed ? Math.round(location.speed) : '--'}</span>
                    <span className="text-sm font-medium text-emerald-200">km/h</span>
                  </div>
                </div>
                <Button
                  onClick={() => setActiveTab('route')}
                  size="sm"
                  className="bg-white/20 hover:bg-white/30 text-white border-0 rounded-xl text-xs font-bold backdrop-blur-sm"
                >
                  <MapPin className="w-3.5 h-3.5 mr-1" />
                  Track Live
                </Button>
              </div>
              {/* Dynamic progress bar based on route position */}
              <div className="mt-2">
                <div className="flex justify-between text-[10px] font-semibold text-emerald-200 mb-1">
                  <span>{data.bus?.routeStart || 'Start'}</span>
                  <span>{routeProgress}%</span>
                  <span>{data.bus?.routeEnd || 'End'}</span>
                </div>
                <div className="bg-white/20 rounded-full h-2 overflow-hidden">
                  <motion.div
                    className="bg-white rounded-full h-2"
                    initial={{ width: '0%' }}
                    animate={{ width: `${routeProgress}%` }}
                    transition={{ duration: 1.5, ease: 'easeOut' }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Find Shuttles CTA - Prominent card for students */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card
          className="rounded-2xl border-2 border-dashed border-emerald-300 dark:border-emerald-700 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20 cursor-pointer hover:shadow-md transition-all hover:border-emerald-400 dark:hover:border-emerald-600"
          onClick={() => setActiveTab('find')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200 dark:shadow-emerald-900/50">
                <Search className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base">Find Shuttles</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Discover routes near you & track live buses</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">New</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Payment Status */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card className={`rounded-2xl border-2 shadow-sm ${status.color}`}>
          <CardContent className="p-5 text-center">
            <StatusIcon className="w-10 h-10 mx-auto mb-2" />
            <Badge className={`text-sm px-4 py-1 ${status.badge}`}>
              {status.label}
            </Badge>
            {data.nextDueDate && (
              <p className="text-sm mt-2 opacity-80">
                Next due: {format(new Date(data.nextDueDate), 'MMM d, yyyy')}
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Subscription Info */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="rounded-2xl border-0 shadow-sm dark:bg-gray-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Current Subscription</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/50 rounded-xl flex items-center justify-center">
                <BusIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold">{data.bus.name}</p>
                <p className="text-xs text-muted-foreground">{data.bus.plateNumber} · {data.bus.routeName}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
                <span className="text-muted-foreground">Type</span>
                <p className="font-semibold">
                  {data.subscription.paymentType === 'MONTHLY' ? 'Monthly' : 'Daily'}
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
                <span className="text-muted-foreground">Amount</span>
                <p className="font-semibold">
                  {formatLKR(
                    data.subscription.paymentType === 'MONTHLY'
                      ? (data.subscription.monthlyAmount || 0)
                      : (data.subscription.dailyAmount || 0)
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Bus Offline Status */}
      {!isLive && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="rounded-2xl border-0 shadow-sm bg-gray-50 dark:bg-gray-800/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-xl flex items-center justify-center">
                    <Radio className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Bus is offline</p>
                    <p className="text-xs text-muted-foreground">Check back later for live tracking</p>
                  </div>
                </div>
                <Button
                  onClick={() => setActiveTab('route')}
                  size="sm"
                  variant="outline"
                  className="rounded-xl text-xs"
                >
                  <MapPin className="w-3.5 h-3.5 mr-1" />
                  View Route
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Quick Stats */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div className="grid grid-cols-2 gap-3">
          <Card className="rounded-2xl border-0 shadow-sm dark:bg-gray-900">
            <CardContent className="p-3 text-center">
              <CreditCard className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatLKR(totalPaidThisMonth)}</p>
              <p className="text-[10px] text-muted-foreground">Paid This Month</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-0 shadow-sm dark:bg-gray-900">
            <CardContent className="p-3 text-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{data.paymentHistory.length}</p>
              <p className="text-[10px] text-muted-foreground">Total Payments</p>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </div>
  )
}
