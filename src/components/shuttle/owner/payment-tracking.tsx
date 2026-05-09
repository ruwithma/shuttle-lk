'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { CreditCard, Plus, Filter, CalendarDays } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import type { Payment } from '@/lib/types'

const formatLKR = (amount: number) => `Rs. ${amount.toLocaleString()}`

const methodBadge = (method: string) => {
  if (method === 'CASH') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
  return 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
}

const typeBadge = (type: string) => {
  if (type === 'DAILY') return 'bg-amber-50 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
  return 'bg-purple-50 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
}

export default function PaymentTracking() {
  const { currentUser, payments, setPayments, buses, subscriptions } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [filterBus, setFilterBus] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [filterMethod, setFilterMethod] = useState('all')
  const [form, setForm] = useState({
    studentId: '',
    amount: '',
    paymentMethod: 'CASH' as 'CASH' | 'BANK_TRANSFER',
    paymentType: 'MONTHLY' as 'DAILY' | 'MONTHLY',
    date: format(new Date(), 'yyyy-MM-dd'),
    note: '',
  })

  useEffect(() => {
    loadPayments()
  }, [currentUser])

  const loadPayments = async () => {
    if (!currentUser) return
    setLoading(true)
    try {
      const res = await fetch(`/api/payments?ownerId=${currentUser.id}`)
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

  const handleSubmit = async () => {
    if (!form.studentId || !form.amount) {
      toast({ title: 'Error', description: 'Please fill in required fields', variant: 'destructive' })
      return
    }
    try {
      const sub = subscriptions.find((s) => s.studentId === form.studentId)
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          amount: parseInt(form.amount),
          busId: sub?.busId || '',
          collectedById: currentUser?.id,
          month: form.paymentType === 'MONTHLY' ? format(new Date(form.date), 'yyyy-MM') : undefined,
        }),
      })
      if (res.ok) {
        toast({ title: 'Success', description: 'Payment recorded' })
        setShowDialog(false)
        setForm({ studentId: '', amount: '', paymentMethod: 'CASH', paymentType: 'MONTHLY', date: format(new Date(), 'yyyy-MM-dd'), note: '' })
        loadPayments()
      } else {
        const data = await res.json()
        toast({ title: 'Error', description: data.error || 'Failed', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' })
    }
  }

  const filtered = payments.filter((p: Payment) => {
    if (filterBus !== 'all' && p.busId !== filterBus) return false
    if (filterType !== 'all' && p.paymentType !== filterType) return false
    if (filterMethod !== 'all' && p.paymentMethod !== filterMethod) return false
    return true
  })

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const todayTotal = payments
    .filter((p) => format(new Date(p.date), 'yyyy-MM-dd') === todayStr)
    .reduce((sum, p) => sum + p.amount, 0)

  const monthTotal = payments
    .filter((p) => {
      const d = new Date(p.date)
      const now = new Date()
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((sum, p) => sum + p.amount, 0)

  const dailyTotal = payments
    .filter((p) => p.paymentType === 'DAILY')
    .reduce((sum, p) => sum + p.amount, 0)

  const monthlyTotal = payments
    .filter((p) => p.paymentType === 'MONTHLY')
    .reduce((sum, p) => sum + p.amount, 0)

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Payments</h2>
        <Button onClick={() => setShowDialog(true)} size="sm" className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-1" />
          Record Payment
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="rounded-2xl border-0 shadow-sm bg-emerald-50 dark:bg-emerald-900/30">
          <CardContent className="p-3">
            <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">Today</p>
            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{formatLKR(todayTotal)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-0 shadow-sm bg-blue-50 dark:bg-blue-900/30">
          <CardContent className="p-3">
            <p className="text-[10px] font-medium text-blue-600 dark:text-blue-400">This Month</p>
            <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{formatLKR(monthTotal)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="rounded-2xl border-0 shadow-sm dark:bg-gray-900">
          <CardContent className="p-3">
            <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400">Daily Total</p>
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{formatLKR(dailyTotal)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-0 shadow-sm dark:bg-gray-900">
          <CardContent className="p-3">
            <p className="text-[10px] font-medium text-purple-600 dark:text-purple-400">Monthly Total</p>
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{formatLKR(monthlyTotal)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2 items-center">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={filterBus} onValueChange={setFilterBus}>
          <SelectTrigger className="h-8 rounded-lg text-xs w-auto">
            <SelectValue placeholder="Bus" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Buses</SelectItem>
            {buses.map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-8 rounded-lg text-xs w-auto">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="DAILY">Daily</SelectItem>
            <SelectItem value="MONTHLY">Monthly</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterMethod} onValueChange={setFilterMethod}>
          <SelectTrigger className="h-8 rounded-lg text-xs w-auto">
            <SelectValue placeholder="Method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Methods</SelectItem>
            <SelectItem value="CASH">Cash</SelectItem>
            <SelectItem value="BANK_TRANSFER">Bank</SelectItem>
          </SelectContent>
        </Select>
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
              <Card className="rounded-xl border-0 shadow-sm dark:bg-gray-900">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-900/50 flex items-center justify-center">
                        <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {payment.student?.name || 'Student'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {payment.date ? format(new Date(payment.date), 'MMM d') : ''}
                          {payment.collector?.name ? ` · by ${payment.collector.name}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{formatLKR(payment.amount)}</p>
                      <div className="flex gap-1 justify-end">
                        <Badge className={`text-[9px] px-1.5 py-0 ${typeBadge(payment.paymentType)}`}>
                          {payment.paymentType === 'DAILY' ? 'Daily' : 'Monthly'}
                        </Badge>
                        <Badge className={`text-[9px] px-1.5 py-0 ${methodBadge(payment.paymentMethod)}`}>
                          {payment.paymentMethod === 'CASH' ? 'Cash' : 'Bank'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        ) : (
          <div className="text-center py-8">
            <CreditCard className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No payments recorded</p>
          </div>
        )}
      </div>

      {/* Record Payment Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Student *</Label>
              <Select value={form.studentId} onValueChange={(val) => {
                const sub = subscriptions.find(s => s.studentId === val)
                setForm({
                  ...form,
                  studentId: val,
                  amount: sub ? String(sub.paymentType === 'MONTHLY' ? sub.monthlyAmount : sub.dailyAmount) : form.amount,
                  paymentType: sub?.paymentType || form.paymentType,
                })
              }}>
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder="Select student" />
                </SelectTrigger>
                <SelectContent>
                  {subscriptions.map((sub) => (
                    <SelectItem key={sub.studentId} value={sub.studentId}>
                      {sub.student?.name || 'Student'} - {sub.bus?.name || ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Amount (Rs.) *</Label>
              <Input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="Amount"
                className="h-10 rounded-xl"
              />
            </div>
            <div>
              <Label className="text-xs">Payment Method</Label>
              <Select value={form.paymentMethod} onValueChange={(val: 'CASH' | 'BANK_TRANSFER') => setForm({ ...form, paymentMethod: val })}>
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Date</Label>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="h-10 rounded-xl pl-10"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Note (optional)</Label>
              <Input
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="Any note..."
                className="h-10 rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button onClick={handleSubmit} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
              Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
