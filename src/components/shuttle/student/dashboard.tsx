'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, AlertCircle, Clock, CreditCard, Bus as BusIcon, MapPin, Radio } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { fetchDashboardData, isCacheFresh } from '@/lib/data-fetcher'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import RefreshIndicator from '@/components/shuttle/shared/refresh-indicator'
import type { StudentDashboard as StudentDashboardType } from '@/lib/types'

const formatLKR = (amount: number) => `Rs. ${amount.toLocaleString()}`

const statusConfig = {
  PAID: { icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-700 border-emerald-200', badge: 'bg-emerald-600 text-white', label: 'PAID' },
  UNPAID: { icon: AlertCircle, color: 'bg-red-50 text-red-700 border-red-200', badge: 'bg-red-500 text-white', label: 'UNPAID' },
  OVERDUE: { icon: Clock, color: 'bg-amber-50 text-amber-700 border-amber-200', badge: 'bg-amber-500 text-white', label: 'OVERDUE' },
}

export default function StudentDashboard() {
  const { currentUser, studentDashboard, setStudentDashboard, setActiveTab, busLocations } = useAppStore()
  // Skip loading skeleton if we already have cached data that is fresh
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

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="h-8 bg-gray-100 rounded-lg animate-pulse w-48" />
        <div className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
        <div className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    )
  }

  const data = studentDashboard || {
    paymentStatus: 'UNPAID' as const,
    nextDueDate: undefined,
    paymentHistory: [],
    subscription: { id: '', studentId: '', busId: '', paymentType: 'MONTHLY' as const, active: false, startDate: '' },
    bus: { id: '', plateNumber: '', name: 'N/A', capacity: 0, routeName: '', routeStart: '', routeEnd: '', routeStops: '', ownerId: '', active: false },
  }

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

  return (
    <div className="relative">
      <RefreshIndicator loading={refreshing} />
      <div className="p-4 space-y-4">
      {/* Welcome */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-xl font-bold text-gray-900">
          {greeting()}, {currentUser?.name?.split(' ')[0]}!
        </h2>
      </motion.div>

      {/* Payment Status */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className={`rounded-2xl border-2 shadow-sm ${status.color}`}>
          <CardContent className="p-6 text-center">
            <StatusIcon className="w-12 h-12 mx-auto mb-2" />
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
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Current Subscription</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                <BusIcon className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold">{data.bus.name}</p>
                <p className="text-xs text-muted-foreground">{data.bus.plateNumber} · {data.bus.routeName}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-gray-50 rounded-lg p-2">
                <span className="text-muted-foreground">Type</span>
                <p className="font-semibold">
                  {data.subscription.paymentType === 'MONTHLY' ? 'Monthly' : 'Daily'}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2">
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

      {/* Bus Status & Track Bus */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Bus Status</p>
                  {data.bus.id && busLocations[data.bus.id]?.isLive ? (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>
                      <p className="text-xs text-emerald-600 font-medium">Bus is on the way</p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-0.5">Bus is offline</p>
                  )}
                </div>
              </div>
              <Button
                onClick={() => setActiveTab('route')}
                size="sm"
                className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs"
              >
                <Radio className="w-3.5 h-3.5 mr-1" />
                Track Bus
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Stats */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div className="grid grid-cols-2 gap-3">
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardContent className="p-3 text-center">
              <CreditCard className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
              <p className="text-lg font-bold text-gray-900">{formatLKR(totalPaidThisMonth)}</p>
              <p className="text-[10px] text-muted-foreground">Paid This Month</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardContent className="p-3 text-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
              <p className="text-lg font-bold text-gray-900">{data.paymentHistory.length}</p>
              <p className="text-[10px] text-muted-foreground">Total Payments</p>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </div>
    </div>
  )
}
