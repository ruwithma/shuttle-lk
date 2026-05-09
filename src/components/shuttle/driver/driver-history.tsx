'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { History, CalendarDays } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { format } from 'date-fns'
import type { Payment } from '@/lib/types'

const formatLKR = (amount: number) => `Rs. ${amount.toLocaleString()}`

export default function DriverHistory() {
  const { currentUser, payments, setPayments } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    loadPayments()
  }, [currentUser])

  const loadPayments = async () => {
    if (!currentUser) return
    setLoading(true)
    try {
      const res = await fetch(`/api/payments?driverId=${currentUser.id}`)
      if (res.ok) {
        const data = await res.json()
        setPayments(data)
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  const myPayments = payments.filter((p: Payment) => p.collectedById === currentUser?.id)
  
  const filtered = myPayments.filter((p: Payment) => {
    if (dateFrom && p.date < dateFrom) return false
    if (dateTo && p.date > dateTo) return false
    return true
  })

  const totalCollected = filtered.reduce((sum, p) => sum + p.amount, 0)

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Payment History</h2>

      {/* Total */}
      <Card className="rounded-2xl border-0 shadow-sm bg-emerald-50 dark:bg-emerald-900/30">
        <CardContent className="p-4 text-center">
          <p className="text-sm text-emerald-600">Total Collected</p>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{formatLKR(totalCollected)}</p>
          <p className="text-xs text-muted-foreground mt-1">{filtered.length} payments</p>
        </CardContent>
      </Card>

      {/* Date Filters */}
      <div className="flex gap-2 items-center">
        <CalendarDays className="w-4 h-4 text-muted-foreground" />
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="h-8 rounded-lg text-xs"
        />
        <span className="text-xs text-muted-foreground">to</span>
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="h-8 rounded-lg text-xs"
        />
      </div>

      {/* Payment List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filtered.length > 0 ? (
          filtered.map((payment: Payment, index: number) => (
            <motion.div
              key={payment.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              <Card className="rounded-xl border-0 shadow-sm">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <History className="w-4 h-4 text-emerald-500" />
                      <div>
                        <p className="text-sm font-medium">{payment.student?.name || 'Student'}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {payment.date ? format(new Date(payment.date), 'MMM d, yyyy') : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{formatLKR(payment.amount)}</p>
                      <Badge className={`text-[9px] px-1.5 py-0 ${payment.paymentMethod === 'CASH' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'}`}>
                        {payment.paymentMethod === 'CASH' ? 'Cash' : 'Bank'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        ) : (
          <div className="text-center py-8">
            <History className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No payment history</p>
          </div>
        )}
      </div>
    </div>
  )
}
