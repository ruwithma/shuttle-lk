'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Bus as BusIcon, CreditCard, HandCoins, Users } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'

const formatLKR = (amount: number) => `Rs. ${amount.toLocaleString()}`

export default function DriverDashboard() {
  const { currentUser, driverDashboard, setDriverDashboard } = useAppStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [currentUser])

  const loadDashboard = async () => {
    if (!currentUser) return
    setLoading(true)
    try {
      const res = await fetch(`/api/dashboard?userId=${currentUser.id}&role=DRIVER`)
      if (res.ok) {
        const data = await res.json()
        setDriverDashboard(data)
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="h-8 bg-gray-100 rounded-lg animate-pulse w-48" />
        <div className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
        <div className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    )
  }

  const data = driverDashboard || {
    todayCollection: 0,
    bus: { id: '', plateNumber: '', name: 'No bus assigned', capacity: 0, routeName: '', routeStart: '', routeEnd: '', routeStops: '', ownerId: '', active: false },
    todayPayments: [],
  }

  const greeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const dailyCount = data.todayPayments.filter(p => p.paymentType === 'DAILY').length
  const monthlyCount = data.todayPayments.filter(p => p.paymentType === 'MONTHLY').length

  return (
    <div className="p-4 space-y-4">
      {/* Welcome */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-xl font-bold text-gray-900">
          {greeting()}, {currentUser?.name?.split(' ')[0]}!
        </h2>
        <p className="text-sm text-muted-foreground">Ready for today&apos;s collections?</p>
      </motion.div>

      {/* Bus Card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="rounded-2xl border-0 shadow-sm bg-emerald-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center">
                <BusIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{data.bus.name}</h3>
                <p className="text-xs text-muted-foreground">{data.bus.plateNumber}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Route:</span>
                <span className="font-medium">{data.bus.routeName || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Capacity:</span>
                <span className="font-medium">{data.bus.capacity} seats</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Today's Collection */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Today&apos;s Collection</p>
            <p className="text-3xl font-bold text-emerald-600 mt-1">{formatLKR(data.todayCollection)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {data.todayPayments.length} payment{data.todayPayments.length !== 1 ? 's' : ''} collected
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Stats */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <div className="grid grid-cols-2 gap-3">
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardContent className="p-3 text-center">
              <HandCoins className="w-5 h-5 text-amber-500 mx-auto mb-1" />
              <p className="text-lg font-bold text-gray-900">{dailyCount}</p>
              <p className="text-[10px] text-muted-foreground">Daily Payments</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardContent className="p-3 text-center">
              <CreditCard className="w-5 h-5 text-purple-500 mx-auto mb-1" />
              <p className="text-lg font-bold text-gray-900">{monthlyCount}</p>
              <p className="text-[10px] text-muted-foreground">Monthly Payments</p>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* Today's Payments */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Today&apos;s Payments</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            {data.todayPayments.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {data.todayPayments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center">
                        <Users className="w-3.5 h-3.5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{payment.student?.name || 'Student'}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {format(new Date(payment.date), 'h:mm a')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatLKR(payment.amount)}</p>
                      <Badge className={`text-[9px] px-1.5 py-0 ${payment.paymentMethod === 'CASH' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
                        {payment.paymentMethod === 'CASH' ? 'Cash' : 'Bank'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No payments collected today</p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
