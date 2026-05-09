'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Plus, Phone, Filter } from 'lucide-react'
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
import type { Subscription } from '@/lib/types'

export default function StudentManagement() {
  const { currentUser, buses, subscriptions, setSubscriptions } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [filterBus, setFilterBus] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    busId: '',
    paymentType: 'MONTHLY' as 'DAILY' | 'MONTHLY',
    monthlyAmount: '',
    dailyAmount: '',
  })

  useEffect(() => {
    loadStudents()
  }, [currentUser])

  const loadStudents = async () => {
    if (!currentUser) return
    setLoading(true)
    try {
      const res = await fetch(`/api/students?ownerId=${currentUser.id}`)
      if (res.ok) {
        const data = await res.json()
        setSubscriptions(data)
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!form.name || !form.phone || !form.busId) {
      toast({ title: 'Error', description: 'Please fill in required fields', variant: 'destructive' })
      return
    }
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          monthlyAmount: form.monthlyAmount ? parseInt(form.monthlyAmount) : null,
          dailyAmount: form.dailyAmount ? parseInt(form.dailyAmount) : null,
          ownerId: currentUser?.id,
        }),
      })
      if (res.ok) {
        toast({ title: 'Success', description: 'Student added' })
        setShowDialog(false)
        setForm({ name: '', phone: '', email: '', busId: '', paymentType: 'MONTHLY', monthlyAmount: '', dailyAmount: '' })
        loadStudents()
      } else {
        const data = await res.json()
        toast({ title: 'Error', description: data.error || 'Failed', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' })
    }
  }

  const filtered = subscriptions.filter((sub) => {
    if (filterBus !== 'all' && sub.busId !== filterBus) return false
    if (filterType !== 'all' && sub.paymentType !== filterType) return false
    return true
  })

  const formatLKR = (amount: number | undefined) => `Rs. ${(amount || 0).toLocaleString()}`

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Students</h2>
        <Button onClick={() => setShowDialog(true)} size="sm" className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-1" />
          Add Student
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <Filter className="w-4 h-4 text-muted-foreground mt-2" />
        <Select value={filterBus} onValueChange={setFilterBus}>
          <SelectTrigger className="h-8 rounded-lg text-xs">
            <SelectValue placeholder="All Buses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Buses</SelectItem>
            {buses.map((bus) => (
              <SelectItem key={bus.id} value={bus.id}>
                {bus.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-8 rounded-lg text-xs">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="MONTHLY">Monthly</SelectItem>
            <SelectItem value="DAILY">Daily</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Student List */}
      <AnimatePresence mode="popLayout">
        {filtered.length > 0 ? (
          <div className="space-y-3">
            {filtered.map((sub: Subscription, index: number) => (
              <motion.div
                key={sub.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="rounded-2xl border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center">
                          <Users className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm text-gray-900">
                            {sub.student?.name || 'Student'}
                          </h3>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="w-3 h-3" />
                            {sub.student?.phone || ''}
                          </div>
                        </div>
                      </div>
                      <Badge
                        className={`text-[10px] ${
                          sub.active
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {sub.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>

                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-[10px]">
                        {sub.bus?.name || 'Bus'}
                      </Badge>
                      <Badge
                        className={`text-[10px] ${
                          sub.paymentType === 'MONTHLY'
                            ? 'bg-purple-50 text-purple-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {sub.paymentType === 'MONTHLY' ? 'Monthly' : 'Daily'}
                      </Badge>
                      <span className="text-xs font-semibold text-gray-700">
                        {sub.paymentType === 'MONTHLY'
                          ? formatLKR(sub.monthlyAmount)
                          : formatLKR(sub.dailyAmount)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No students found</p>
          </div>
        )}
      </AnimatePresence>

      {/* Add Student Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-sm rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Student</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Full Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Student name"
                className="h-10 rounded-xl"
              />
            </div>
            <div>
              <Label className="text-xs">Phone Number *</Label>
              <Input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="07XXXXXXXX"
                className="h-10 rounded-xl"
              />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="student@email.com"
                className="h-10 rounded-xl"
              />
            </div>
            <div>
              <Label className="text-xs">Assign to Bus *</Label>
              <Select value={form.busId} onValueChange={(val) => setForm({ ...form, busId: val })}>
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder="Select bus" />
                </SelectTrigger>
                <SelectContent>
                  {buses.map((bus) => (
                    <SelectItem key={bus.id} value={bus.id}>
                      {bus.name} ({bus.plateNumber})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Payment Type</Label>
              <Select
                value={form.paymentType}
                onValueChange={(val: 'DAILY' | 'MONTHLY') => setForm({ ...form, paymentType: val })}
              >
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="DAILY">Daily</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.paymentType === 'MONTHLY' ? (
              <div>
                <Label className="text-xs">Monthly Amount (Rs.)</Label>
                <Input
                  type="number"
                  value={form.monthlyAmount}
                  onChange={(e) => setForm({ ...form, monthlyAmount: e.target.value })}
                  placeholder="e.g. 3500"
                  className="h-10 rounded-xl"
                />
              </div>
            ) : (
              <div>
                <Label className="text-xs">Daily Amount (Rs.)</Label>
                <Input
                  type="number"
                  value={form.dailyAmount}
                  onChange={(e) => setForm({ ...form, dailyAmount: e.target.value })}
                  placeholder="e.g. 150"
                  className="h-10 rounded-xl"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button onClick={handleSubmit} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
              Add Student
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
