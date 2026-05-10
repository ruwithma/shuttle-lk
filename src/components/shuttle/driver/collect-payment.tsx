'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { HandCoins, Banknote, Building2, CreditCard, Users, Loader2 } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { formatLKR } from '@/lib/utils'
import type { Subscription, Bus, Payment } from '@/lib/types'

export default function CollectPayment() {
  const { currentUser } = useAppStore()
  const [selectedSub, setSelectedSub] = useState<Subscription | null>(null)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<'CASH' | 'BANK_TRANSFER'>('CASH')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [driverBus, setDriverBus] = useState<Bus | null>(null)
  const [busSubscriptions, setBusSubscriptions] = useState<Subscription[]>([])
  const [recentCollections, setRecentCollections] = useState<Payment[]>([])

  useEffect(() => {
    loadData()
  }, [currentUser])

  const loadData = async () => {
    if (!currentUser) return
    setLoading(true)
    try {
      const res = await fetch(`/api/dashboard?userId=${currentUser.id}&role=DRIVER`)
      if (res.ok) {
        const data = await res.json()
        setDriverBus(data.bus || null)
        setBusSubscriptions(data.subscriptions || [])
      }
      // Load recent payments
      const payRes = await fetch(`/api/payments?driverId=${currentUser.id}`)
      if (payRes.ok) {
        const payData = await payRes.json()
        setRecentCollections((payData || []).slice(0, 10))
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  const handleSelectStudent = (subId: string) => {
    const sub = busSubscriptions.find((s) => s.id === subId)
    setSelectedSub(sub || null)
    if (sub) {
      setAmount(String(sub.paymentType === 'MONTHLY' ? sub.monthlyAmount || '' : sub.dailyAmount || ''))
    }
  }

  const handleCollect = async () => {
    if (!selectedSub || !amount) {
      toast({ title: 'Error', description: 'Please select a student and enter amount', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      const now = new Date()
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: selectedSub.studentId,
          busId: selectedSub.busId,
          amount: parseFloat(amount),
          paymentMethod: method,
          paymentType: selectedSub.paymentType,
          collectedById: currentUser?.id,
          subscriptionId: selectedSub.id,
          date: now.toISOString().split('T')[0],
          month: selectedSub.paymentType === 'MONTHLY' ? currentMonth : undefined,
          note,
        }),
      })
      if (res.ok) {
        const newPayment = await res.json()
        setRecentCollections(prev => [newPayment, ...prev])
        toast({ title: 'Collected!', description: `${formatLKR(parseFloat(amount))} from ${selectedSub.student?.name || 'Student'}` })
        setSelectedSub(null)
        setAmount('')
        setNote('')
      } else {
        const data = await res.json()
        toast({ title: 'Error', description: data.error || 'Failed', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 space-y-4 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600 dark:text-emerald-400" />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Collect Payment</h2>

      {/* Bus Info */}
      {driverBus && (
        <Card className="rounded-2xl border-0 shadow-sm bg-emerald-50 dark:bg-emerald-900/30">
          <CardContent className="p-3">
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Assigned Bus</p>
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{driverBus.name} - {driverBus.plateNumber}</p>
          </CardContent>
        </Card>
      )}

      {/* Student Selection */}
      <Card className="rounded-2xl border-0 shadow-sm dark:bg-gray-900">
        <CardContent className="p-4 space-y-4">
          <div>
            <Label className="text-xs">Select Student</Label>
            <Select onValueChange={handleSelectStudent}>
              <SelectTrigger className="h-10 rounded-xl w-full">
                <SelectValue placeholder="Choose a student" />
              </SelectTrigger>
              <SelectContent>
                {busSubscriptions.map((sub) => (
                  <SelectItem key={sub.id} value={sub.id}>
                    {sub.student?.name || 'Student'} - {sub.paymentType === 'MONTHLY' ? 'Monthly' : 'Daily'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedSub && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-3"
            >
              {/* Student Info */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-900/50 flex items-center justify-center">
                  <Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{selectedSub.student?.name}</p>
                  <div className="flex gap-1 mt-0.5">
                    <Badge className={`text-[9px] px-1.5 py-0 ${selectedSub.paymentType === 'MONTHLY' ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'}`}>
                      {selectedSub.paymentType === 'MONTHLY' ? 'Monthly' : 'Daily'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Due: {formatLKR(selectedSub.paymentType === 'MONTHLY' ? (selectedSub.monthlyAmount || 0) : (selectedSub.dailyAmount || 0))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Method Toggle */}
              <div>
                <Label className="text-xs">Payment Method</Label>
                <div className="flex gap-2 mt-1">
                  <Button
                    type="button"
                    variant={method === 'CASH' ? 'default' : 'outline'}
                    className={`flex-1 h-10 rounded-xl ${method === 'CASH' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                    onClick={() => setMethod('CASH')}
                  >
                    <Banknote className="w-4 h-4 mr-1" />
                    Cash
                  </Button>
                  <Button
                    type="button"
                    variant={method === 'BANK_TRANSFER' ? 'default' : 'outline'}
                    className={`flex-1 h-10 rounded-xl ${method === 'BANK_TRANSFER' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                    onClick={() => setMethod('BANK_TRANSFER')}
                  >
                    <Building2 className="w-4 h-4 mr-1" />
                    Bank
                  </Button>
                </div>
              </div>

              {/* Amount */}
              <div>
                <Label className="text-xs">Amount (Rs.)</Label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-10 rounded-xl text-lg font-bold"
                />
              </div>

              {/* Note */}
              <div>
                <Label className="text-xs">Note (optional)</Label>
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Any note..."
                  className="h-10 rounded-xl"
                />
              </div>

              {/* Collect Button */}
              <Button
                onClick={handleCollect}
                disabled={submitting}
                className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <HandCoins className="w-5 h-5 mr-2" />}
                Collect Payment
              </Button>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Recent Collections */}
      {recentCollections.length > 0 && (
        <Card className="rounded-2xl border-0 shadow-sm dark:bg-gray-900">
          <CardContent className="p-4">
            <p className="text-sm font-semibold mb-3 dark:text-gray-100">Recent Collections</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {recentCollections.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm text-gray-900 dark:text-gray-100">{payment.student?.name || 'Student'}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatLKR(payment.amount)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
