'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Receipt, Plus, Filter, Fuel, Wrench, Banknote, Package } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import type { Expense, ExpenseCategory } from '@/lib/types'

const formatLKR = (amount: number) => `Rs. ${amount.toLocaleString()}`

const categoryConfig: Record<ExpenseCategory, { color: string; icon: React.ElementType }> = {
  FUEL: { color: 'bg-amber-50 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300', icon: Fuel },
  MAINTENANCE: { color: 'bg-red-50 text-red-700 dark:bg-red-900/50 dark:text-red-300', icon: Wrench },
  SALARY: { color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300', icon: Banknote },
  OTHER: { color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300', icon: Package },
}

export default function ExpenseTracking() {
  const { currentUser, expenses, setExpenses, buses } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [filterBus, setFilterBus] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [form, setForm] = useState({
    busId: '',
    category: 'FUEL' as ExpenseCategory,
    amount: '',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd'),
  })

  useEffect(() => {
    loadExpenses()
  }, [currentUser])

  const loadExpenses = async () => {
    if (!currentUser) return
    setLoading(true)
    try {
      const res = await fetch(`/api/expenses?ownerId=${currentUser.id}`)
      if (res.ok) {
        const data = await res.json()
        setExpenses(data)
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!form.busId || !form.amount) {
      toast({ title: 'Error', description: 'Please fill in required fields', variant: 'destructive' })
      return
    }
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          amount: parseInt(form.amount),
          recordedById: currentUser?.id,
        }),
      })
      if (res.ok) {
        toast({ title: 'Success', description: 'Expense added' })
        setShowDialog(false)
        setForm({ busId: '', category: 'FUEL', amount: '', description: '', date: format(new Date(), 'yyyy-MM-dd') })
        loadExpenses()
      } else {
        const data = await res.json()
        toast({ title: 'Error', description: data.error || 'Failed', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' })
    }
  }

  const filtered = expenses.filter((e: Expense) => {
    if (filterBus !== 'all' && e.busId !== filterBus) return false
    if (filterCategory !== 'all' && e.category !== filterCategory) return false
    return true
  })

  // Category summary
  const categorySummary = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount
    return acc
  }, {} as Record<string, number>)

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Expenses</h2>
        <Button onClick={() => setShowDialog(true)} size="sm" className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-1" />
          Add Expense
        </Button>
      </div>

      {/* Category Summary */}
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(categoryConfig) as ExpenseCategory[]).map((cat) => {
          const config = categoryConfig[cat]
          const Icon = config.icon
          return (
            <Card key={cat} className="rounded-2xl border-0 shadow-sm">
              <CardContent className="p-3 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${config.color.split(' ').filter(c => c.startsWith('bg-') || c.startsWith('dark:bg-')).join(' ')}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">{cat.charAt(0) + cat.slice(1).toLowerCase()}</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{formatLKR(categorySummary[cat] || 0)}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
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
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="h-8 rounded-lg text-xs w-auto">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="FUEL">Fuel</SelectItem>
            <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
            <SelectItem value="SALARY">Salary</SelectItem>
            <SelectItem value="OTHER">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Expense List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filtered.length > 0 ? (
          filtered.map((expense: Expense, index: number) => {
            const config = categoryConfig[expense.category as ExpenseCategory] || categoryConfig.OTHER
            return (
              <motion.div
                key={expense.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <Card className="rounded-xl border-0 shadow-sm">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${config.color.split(' ').filter(c => c.startsWith('bg-') || c.startsWith('dark:bg-')).join(' ')}`}>
                          <config.icon className={`w-4 h-4 ${config.color.split(' ').find(c => c.startsWith('text-')) || ''}`} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {expense.description || expense.category.charAt(0) + expense.category.slice(1).toLowerCase()}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge className={`text-[9px] px-1.5 py-0 ${config.color}`}>
                              {expense.category}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {expense.bus?.name || ''}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-red-600 dark:text-red-400">-{formatLKR(expense.amount)}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {expense.date ? format(new Date(expense.date), 'MMM d') : ''}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })
        ) : (
          <div className="text-center py-8">
            <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No expenses recorded</p>
          </div>
        )}
      </div>

      {/* Add Expense Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Bus *</Label>
              <Select value={form.busId} onValueChange={(val) => setForm({ ...form, busId: val })}>
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder="Select bus" />
                </SelectTrigger>
                <SelectContent>
                  {buses.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={form.category} onValueChange={(val: ExpenseCategory) => setForm({ ...form, category: val })}>
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FUEL">Fuel</SelectItem>
                  <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                  <SelectItem value="SALARY">Salary</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
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
              <Label className="text-xs">Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What was this expense for?"
                className="h-10 rounded-xl"
              />
            </div>
            <div>
              <Label className="text-xs">Date</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="h-10 rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button onClick={handleSubmit} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
              Add Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
