'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  CreditCard,
  Banknote,
  Bus,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns'

const formatLKR = (amount: number) => `Rs. ${Math.round(amount).toLocaleString()}`

// Colors
const INCOME_COLOR = '#059669' // emerald-600
const EXPENSE_COLOR = '#ef4444' // red-500
const PROFIT_COLOR = '#10b981' // emerald-500

const PAYMENT_METHOD_COLORS = ['#059669', '#6366f1'] // emerald, indigo
const EXPENSE_CATEGORY_COLORS = ['#f59e0b', '#ef4444', '#6366f1', '#94a3b8'] // amber, red, indigo, slate

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  FUEL: 'Fuel',
  MAINTENANCE: 'Maintenance',
  SALARY: 'Salary',
  OTHER: 'Other',
}

interface BusData {
  id: string
  name: string
  plateNumber: string
  income: number
  expenses: number
  netProfit: number
  studentCount: number
  collectionRate: number
}

interface ReportsProps {
  onBack: () => void
}

export default function OwnerReports({ onBack }: ReportsProps) {
  const { currentUser } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const [monthlyOverview, setMonthlyOverview] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    netProfit: 0,
    collectionRate: 0,
  })
  const [busBreakdown, setBusBreakdown] = useState<BusData[]>([])
  const [paymentMethodData, setPaymentMethodData] = useState<{ name: string; value: number }[]>([])
  const [expenseCategoryData, setExpenseCategoryData] = useState<{ name: string; value: number }[]>([])
  const [monthlyTrend, setMonthlyTrend] = useState<{ month: string; income: number; expenses: number; profit: number }[]>([])

  const selectedDate = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number)
    return { year, month }
  }, [selectedMonth])

  const monthLabel = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const date = new Date(year, month - 1, 1)
    return format(date, 'MMMM yyyy')
  }, [selectedMonth])

  const navigateMonth = useCallback((direction: -1 | 1) => {
    setSelectedMonth((prev) => {
      const [year, month] = prev.split('-').map(Number)
      const date = new Date(year, month - 1 + direction, 1)
      return format(date, 'yyyy-MM')
    })
  }, [])

  const loadData = useCallback(async () => {
    if (!currentUser) return
    setLoading(true)
    try {
      const [payRes, expRes, busRes, dashRes] = await Promise.all([
        fetch(`/api/payments?ownerId=${currentUser.id}`),
        fetch(`/api/expenses?ownerId=${currentUser.id}&month=${selectedMonth}`),
        fetch(`/api/buses?ownerId=${currentUser.id}`),
        fetch(`/api/dashboard?userId=${currentUser.id}&role=OWNER`),
      ])

      const payments = payRes.ok ? await payRes.json() : []
      const expenses = expRes.ok ? await expRes.json() : []
      const buses = busRes.ok ? await busRes.json() : []
      const dashboard = dashRes.ok ? await dashRes.json() : null

      // Filter payments by selected month date range
      const [selYear, selMonth] = selectedMonth.split('-').map(Number)
      const monthStart = startOfMonth(new Date(selYear, selMonth - 1, 1))
      const monthEnd = endOfMonth(new Date(selYear, selMonth - 1, 1))

      const monthlyPayments = payments.filter((p: { date: string }) => {
        try {
          const paymentDate = new Date(p.date)
          return isWithinInterval(paymentDate, { start: monthStart, end: monthEnd })
        } catch {
          return false
        }
      })

      // Monthly overview
      const totalIncome = monthlyPayments.reduce((sum: number, p: { amount: number }) => sum + p.amount, 0)
      const totalExpenses = expenses.reduce((sum: number, e: { amount: number }) => sum + e.amount, 0)
      const netProfit = totalIncome - totalExpenses

      // Collection rate - calculate from monthly subscriptions
      let collectionRate = 0
      if (dashboard && dashboard.collectionRate !== undefined && selectedMonth === format(new Date(), 'yyyy-MM')) {
        collectionRate = dashboard.collectionRate
      } else {
        // Calculate collection rate for the selected month
        const busIds = buses.map((b: { id: string }) => b.id)
        const monthlySubscriptions = buses.reduce((count: number, bus: { subscriptions?: unknown[] }) => {
          return count + (bus.subscriptions ? bus.subscriptions.length : 0)
        }, 0)
        if (monthlySubscriptions > 0) {
          const uniquePaidStudents = new Set(
            monthlyPayments
              .filter((p: { paymentType: string }) => p.paymentType === 'MONTHLY')
              .map((p: { studentId: string }) => p.studentId)
          )
          collectionRate = Math.round((uniquePaidStudents.size / monthlySubscriptions) * 1000) / 10
        }
      }

      setMonthlyOverview({ totalIncome, totalExpenses, netProfit, collectionRate })

      // Per-bus breakdown
      const busData: BusData[] = buses.map((bus: { id: string; name: string; plateNumber: string; _count?: { subscriptions?: number } }) => {
        const busPayments = monthlyPayments.filter((p: { busId: string }) => p.busId === bus.id)
        const busExpenses = expenses.filter((e: { busId: string }) => e.busId === bus.id)
        const busIncome = busPayments.reduce((sum: number, p: { amount: number }) => sum + p.amount, 0)
        const busExpenseTotal = busExpenses.reduce((sum: number, e: { amount: number }) => sum + e.amount, 0)
        const busNetProfit = busIncome - busExpenseTotal
        const studentCount = bus._count?.subscriptions || 0

        // Calculate per-bus collection rate
        let busCollectionRate = 0
        const monthlyPaymentsForBus = busPayments.filter((p: { paymentType: string }) => p.paymentType === 'MONTHLY')
        if (studentCount > 0) {
          const uniquePaid = new Set(monthlyPaymentsForBus.map((p: { studentId: string }) => p.studentId))
          busCollectionRate = Math.round((uniquePaid.size / studentCount) * 1000) / 10
        }

        return {
          id: bus.id,
          name: bus.name,
          plateNumber: bus.plateNumber,
          income: busIncome,
          expenses: busExpenseTotal,
          netProfit: busNetProfit,
          studentCount,
          collectionRate: busCollectionRate,
        }
      })
      setBusBreakdown(busData)

      // Payment method breakdown
      const cashTotal = monthlyPayments
        .filter((p: { paymentMethod: string }) => p.paymentMethod === 'CASH')
        .reduce((sum: number, p: { amount: number }) => sum + p.amount, 0)
      const bankTotal = monthlyPayments
        .filter((p: { paymentMethod: string }) => p.paymentMethod === 'BANK_TRANSFER')
        .reduce((sum: number, p: { amount: number }) => sum + p.amount, 0)

      const methodData: { name: string; value: number }[] = []
      if (cashTotal > 0) methodData.push({ name: 'Cash', value: Math.round(cashTotal) })
      if (bankTotal > 0) methodData.push({ name: 'Bank Transfer', value: Math.round(bankTotal) })
      if (methodData.length === 0) methodData.push({ name: 'No Data', value: 0 })
      setPaymentMethodData(methodData)

      // Expense category breakdown
      const categories: Record<string, number> = { FUEL: 0, MAINTENANCE: 0, SALARY: 0, OTHER: 0 }
      expenses.forEach((e: { category: string; amount: number }) => {
        if (categories[e.category] !== undefined) {
          categories[e.category] += e.amount
        }
      })
      const catData = Object.entries(categories)
        .filter(([, value]) => value > 0)
        .map(([key, value]) => ({ name: EXPENSE_CATEGORY_LABELS[key] || key, value: Math.round(value) }))
      if (catData.length === 0) catData.push({ name: 'No Data', value: 0 })
      setExpenseCategoryData(catData)

      // Monthly trend - from dashboard (last 6 months)
      if (dashboard?.monthlyData) {
        setMonthlyTrend(dashboard.monthlyData.map((d: { month: string; income: number; expenses: number; profit?: number }) => ({
          month: d.month,
          income: d.income,
          expenses: d.expenses,
          profit: d.profit !== undefined ? d.profit : d.income - d.expenses,
        })))
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [currentUser, selectedMonth])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Mini bar chart data for overview
  const overviewBarData = useMemo(() => [
    { name: 'Income', amount: monthlyOverview.totalIncome, fill: INCOME_COLOR },
    { name: 'Expenses', amount: monthlyOverview.totalExpenses, fill: EXPENSE_COLOR },
  ], [monthlyOverview])

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 px-3 py-2 text-xs">
          <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="font-medium">
              {entry.name}: {formatLKR(entry.value)}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  const PieTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { name: string; value: number } }> }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 px-3 py-2 text-xs">
          <p className="font-semibold text-gray-700 dark:text-gray-300">{payload[0].name}</p>
          <p className="text-emerald-600 font-medium">{formatLKR(payload[0].value)}</p>
        </div>
      )
    }
    return null
  }

  const renderPieLabel = ({ name, percent }: { name: string; percent: number }) => {
    if (percent < 0.05) return ''
    return `${name} ${(percent * 100).toFixed(0)}%`
  }

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-16 rounded-xl" />
          <Skeleton className="h-6 w-32 rounded-lg" />
        </div>
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-5 pb-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="rounded-xl p-0 h-8 w-8"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Financial Reports</h2>
      </motion.div>

      {/* Month Selector */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateMonth(-1)}
                className="h-8 w-8 p-0 rounded-lg"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="text-center">
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{monthLabel}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateMonth(1)}
                className="h-8 w-8 p-0 rounded-lg"
                disabled={selectedMonth >= format(new Date(), 'yyyy-MM')}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Section 1: Monthly Overview */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">Monthly Overview</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50 dark:bg-emerald-900/30 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">Income</span>
                </div>
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{formatLKR(monthlyOverview.totalIncome)}</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/30 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingDown className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                  <span className="text-[11px] text-red-700 dark:text-red-300 font-medium">Expenses</span>
                </div>
                <p className="text-sm font-bold text-red-700 dark:text-red-300">{formatLKR(monthlyOverview.totalExpenses)}</p>
              </div>
              <div className={`rounded-xl p-3 ${monthlyOverview.netProfit >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/30' : 'bg-red-50 dark:bg-red-900/30'}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <DollarSign className={`w-3.5 h-3.5 ${monthlyOverview.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`} />
                  <span className={`text-[11px] font-medium ${monthlyOverview.netProfit >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                    Net {monthlyOverview.netProfit >= 0 ? 'Profit' : 'Loss'}
                  </span>
                </div>
                <p className={`text-sm font-bold ${monthlyOverview.netProfit >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                  {formatLKR(Math.abs(monthlyOverview.netProfit))}
                </p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/30 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Users className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">Collection</span>
                </div>
                <p className="text-sm font-bold text-amber-700 dark:text-amber-300">{monthlyOverview.collectionRate}%</p>
              </div>
            </div>

            {/* Mini Bar Chart */}
            <div className="h-[200px] mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={overviewBarData} barSize={48}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={60} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                    {overviewBarData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Section 2: Per-Bus Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">Per-Bus Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {busBreakdown.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                {busBreakdown.map((bus, index) => (
                  <motion.div
                    key={bus.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * index }}
                  >
                    <Card className="rounded-xl border border-gray-100 dark:border-gray-700 shadow-none">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/50 flex items-center justify-center">
                            <Bus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{bus.name}</p>
                            <p className="text-[11px] text-muted-foreground">{bus.plateNumber}</p>
                          </div>
                          <Badge
                            variant="secondary"
                            className={`text-[10px] px-2 py-0.5 ${
                              bus.netProfit >= 0
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                                : 'bg-red-50 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                            }`}
                          >
                            {bus.netProfit >= 0 ? 'Profit' : 'Loss'}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="text-[10px] text-muted-foreground">Income</p>
                            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{formatLKR(bus.income)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Expenses</p>
                            <p className="text-xs font-bold text-red-600 dark:text-red-400">{formatLKR(bus.expenses)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Net</p>
                            <p className={`text-xs font-bold ${bus.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                              {formatLKR(Math.abs(bus.netProfit))}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50 dark:border-gray-700">
                          <div className="flex items-center gap-1">
                            <Users className="w-3 h-3 text-gray-400" />
                            <span className="text-[11px] text-muted-foreground">{bus.studentCount} students</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-muted-foreground">Collection</span>
                            <div className="flex items-center gap-1">
                              <Progress value={bus.collectionRate} className="h-1.5 w-12" />
                              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">{bus.collectionRate}%</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Bus className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No buses found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Section 3: Payment Method Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">Payment Method Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentMethodData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                    label={renderPieLabel}
                    labelLine={false}
                  >
                    {paymentMethodData.map((_, index) => (
                      <Cell key={`cell-pm-${index}`} fill={PAYMENT_METHOD_COLORS[index % PAYMENT_METHOD_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-1">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PAYMENT_METHOD_COLORS[0] }} />
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Banknote className="w-3 h-3" /> Cash
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PAYMENT_METHOD_COLORS[1] }} />
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <CreditCard className="w-3 h-3" /> Bank Transfer
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Section 4: Expense Category Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">Expense Category Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseCategoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                    label={renderPieLabel}
                    labelLine={false}
                  >
                    {expenseCategoryData.map((_, index) => (
                      <Cell key={`cell-ec-${index}`} fill={EXPENSE_CATEGORY_COLORS[index % EXPENSE_CATEGORY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-3 mt-1">
              {expenseCategoryData.filter((d) => d.name !== 'No Data').map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-1.5">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: EXPENSE_CATEGORY_COLORS[index % EXPENSE_CATEGORY_COLORS.length] }}
                  />
                  <span className="text-[11px] text-muted-foreground">{entry.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Section 5: Monthly Trend */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">6-Month Trend</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {monthlyTrend.length > 0 ? (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: string) => {
                        const parts = v.split('-')
                        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                        return monthNames[parseInt(parts[1]) - 1] || v
                      }}
                    />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={55} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                    <Line type="monotone" dataKey="income" stroke={INCOME_COLOR} strokeWidth={2} dot={{ r: 3, fill: INCOME_COLOR }} name="Income" />
                    <Line type="monotone" dataKey="expenses" stroke={EXPENSE_COLOR} strokeWidth={2} dot={{ r: 3, fill: EXPENSE_COLOR }} name="Expenses" />
                    <Line type="monotone" dataKey="profit" stroke={PROFIT_COLOR} strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: PROFIT_COLOR }} name="Profit" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-8">
                <TrendingUp className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No trend data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
