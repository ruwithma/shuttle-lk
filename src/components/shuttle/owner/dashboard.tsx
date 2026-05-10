'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Users, TrendingUp, TrendingDown, DollarSign, Plus, Receipt, MapPin, Bus as BusIcon } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useAppStore } from '@/lib/store'
import { fetchDashboardData, isCacheFresh } from '@/lib/data-fetcher'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import StatCard from '@/components/shuttle/shared/stat-card'
import RefreshIndicator from '@/components/shuttle/shared/refresh-indicator'
import { useFleetLocations } from '@/components/shuttle/shared/bus-location-hook'
import { format } from 'date-fns'
import { formatLKR } from '@/lib/utils'
import type { DashboardStats } from '@/lib/types'

export default function OwnerDashboard() {
  const { currentUser, dashboardStats, setDashboardStats, setActiveTab, buses } = useAppStore()
  const { locations: fleetLocations } = useFleetLocations(currentUser?.id ?? null)
  // Skip loading skeleton if we already have cached data that is fresh
  const [loading, setLoading] = useState(!dashboardStats || !isCacheFresh('OWNER'))
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadDashboard()
  }, [currentUser])

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (!currentUser) return
    if (isRefresh) {
      setRefreshing(true)
    } else if (!dashboardStats || !isCacheFresh('OWNER')) {
      setLoading(true)
    }
    try {
      const data = await fetchDashboardData<DashboardStats>(currentUser.id, 'OWNER')
      if (data) {
        setDashboardStats(data)
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [currentUser, setDashboardStats, dashboardStats])

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse w-48" />
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="h-48 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
      </div>
    )
  }

  const stats = dashboardStats || {
    totalStudents: 0,
    monthlyIncome: 0,
    totalExpenses: 0,
    netProfit: 0,
    collectionRate: 0,
    recentPayments: [],
    monthlyData: [],
  }

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
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          {greeting()}, {currentUser?.name?.split(' ')[0]}!
        </h2>
        <p className="text-sm text-muted-foreground">Here&apos;s your shuttle overview</p>
      </motion.div>

      {/* Stat Cards */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 gap-3"
      >
        <StatCard
          title="Total Students"
          value={stats.totalStudents}
          icon={Users}
          iconColor="text-emerald-600 dark:text-emerald-400"
          iconBg="bg-emerald-50 dark:bg-emerald-900/50"
        />
        <StatCard
          title="Monthly Income"
          value={formatLKR(stats.monthlyIncome)}
          icon={TrendingUp}
          iconColor="text-green-600 dark:text-green-400"
          iconBg="bg-green-50 dark:bg-green-900/50"
        />
        <StatCard
          title="Total Expenses"
          value={formatLKR(stats.totalExpenses)}
          icon={TrendingDown}
          iconColor="text-red-600 dark:text-red-400"
          iconBg="bg-red-50 dark:bg-red-900/50"
        />
        <StatCard
          title="Net Profit"
          value={formatLKR(stats.netProfit)}
          icon={DollarSign}
          iconColor={stats.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}
          iconBg={stats.netProfit >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/50' : 'bg-red-50 dark:bg-red-900/50'}
        />
      </motion.div>

      {/* Collection Rate */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="rounded-2xl border-0 shadow-sm dark:bg-gray-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Collection Rate</span>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{stats.collectionRate}%</span>
            </div>
            <Progress value={stats.collectionRate} className="h-2" />
          </CardContent>
        </Card>
      </motion.div>

      {/* Income vs Expenses Chart */}
      {stats.monthlyData && stats.monthlyData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="rounded-2xl border-0 shadow-sm dark:bg-gray-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-900 dark:text-gray-100">Income vs Expenses</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                    <Tooltip
                      formatter={(value: number) => formatLKR(value)}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', backgroundColor: 'var(--popover)', color: 'var(--popover-foreground)' }}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="income" fill="#059669" radius={[4, 4, 0, 0]} name="Income" />
                    <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} name="Expenses" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Fleet Overview */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <Card className="rounded-2xl border-0 shadow-sm dark:bg-gray-900">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-gray-900 dark:text-gray-100">Fleet Overview</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveTab('fleet-tracking')}
                className="text-xs text-emerald-600 dark:text-emerald-400 h-7 px-2"
              >
                View Fleet →
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="flex items-center gap-4 mb-3">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  {fleetLocations.filter(l => l.isLive).length} Live
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex rounded-full h-2.5 w-2.5 bg-gray-300 dark:bg-gray-600" />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {fleetLocations.filter(l => !l.isLive).length} Offline
                </span>
              </div>
            </div>
            {buses.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {buses.map((bus, idx) => {
                  const loc = fleetLocations.find(l => l.busId === bus.id)
                  const isLive = loc?.isLive ?? false
                  return (
                    <div
                      key={bus.id}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                        isLive
                          ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                          : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                      }`}
                      onClick={() => setActiveTab('fleet-tracking')}
                    >
                      <BusIcon className="w-3 h-3" />
                      <span className="truncate max-w-[80px]">{bus.name}</span>
                      {isLive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No buses added yet</p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <div className="flex gap-2">
          <Button
            onClick={() => setActiveTab('payments')}
            className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Payment
          </Button>
          <Button
            onClick={() => setActiveTab('expenses')}
            variant="outline"
            className="flex-1 h-10 rounded-xl text-sm"
          >
            <Receipt className="w-4 h-4 mr-1" />
            Add Expense
          </Button>
          <Button
            onClick={() => setActiveTab('fleet-tracking')}
            variant="outline"
            className="flex-1 h-10 rounded-xl text-sm"
          >
            <MapPin className="w-4 h-4 mr-1" />
            Track Fleet
          </Button>
        </div>
      </motion.div>

      {/* Recent Payments */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="rounded-2xl border-0 shadow-sm dark:bg-gray-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-900 dark:text-gray-100">Recent Payments</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            {stats.recentPayments && stats.recentPayments.length > 0 ? (
              <div className="space-y-3">
                {stats.recentPayments.slice(0, 5).map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/50 flex items-center justify-center">
                        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                          {payment.student?.name?.charAt(0) || 'S'}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {payment.student?.name || 'Student'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {payment.date ? format(new Date(payment.date), 'MMM d, yyyy') : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {formatLKR(payment.amount)}
                      </p>
                      <div className="flex gap-1 justify-end">
                        <Badge
                          variant="secondary"
                          className={`text-[10px] px-1.5 py-0 ${
                            payment.paymentMethod === 'CASH'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                              : 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                          }`}
                        >
                          {payment.paymentMethod === 'CASH' ? 'Cash' : 'Bank'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No recent payments</p>
            )}
          </CardContent>
        </Card>
      </motion.div>
      </div>
    </div>
  )
}
