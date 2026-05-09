'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bus as BusIcon, Plus, Edit, Trash2, MapPin, Users } from 'lucide-react'
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
import type { Bus } from '@/lib/types'

export default function BusManagement() {
  const { currentUser, buses, setBuses, busLocations } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingBus, setEditingBus] = useState<Bus | null>(null)
  const [form, setForm] = useState({
    plateNumber: '',
    name: '',
    capacity: '',
    routeName: '',
    routeStart: '',
    routeEnd: '',
    routeStops: '',
    driverId: '',
  })

  useEffect(() => {
    loadBuses()
  }, [currentUser])

  const loadBuses = async () => {
    if (!currentUser) return
    setLoading(true)
    try {
      const res = await fetch(`/api/buses?ownerId=${currentUser.id}`)
      if (res.ok) {
        const data = await res.json()
        setBuses(data)
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  const openAdd = () => {
    setEditingBus(null)
    setForm({ plateNumber: '', name: '', capacity: '', routeName: '', routeStart: '', routeEnd: '', routeStops: '', driverId: '' })
    setShowDialog(true)
  }

  const openEdit = (bus: Bus) => {
    setEditingBus(bus)
    setForm({
      plateNumber: bus.plateNumber,
      name: bus.name,
      capacity: String(bus.capacity),
      routeName: bus.routeName,
      routeStart: bus.routeStart,
      routeEnd: bus.routeEnd,
      routeStops: bus.routeStops,
      driverId: bus.driverId || '',
    })
    setShowDialog(true)
  }

  const handleSubmit = async () => {
    if (!form.plateNumber || !form.name || !form.capacity) {
      toast({ title: 'Error', description: 'Please fill in required fields', variant: 'destructive' })
      return
    }
    try {
      const method = editingBus ? 'PUT' : 'POST'
      const body = {
        ...form,
        capacity: parseInt(form.capacity),
        ownerId: currentUser?.id,
        id: editingBus?.id,
      }
      const res = await fetch('/api/buses', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        toast({ title: 'Success', description: editingBus ? 'Bus updated' : 'Bus added' })
        setShowDialog(false)
        loadBuses()
      } else {
        const data = await res.json()
        toast({ title: 'Error', description: data.error || 'Failed', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' })
    }
  }

  const handleDelete = async (busId: string) => {
    try {
      const res = await fetch(`/api/buses?id=${busId}`, { method: 'DELETE' })
      if (res.ok) {
        toast({ title: 'Deleted', description: 'Bus removed' })
        loadBuses()
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' })
    }
  }

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">My Buses</h2>
        <Button onClick={openAdd} size="sm" className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-1" />
          Add Bus
        </Button>
      </div>

      <AnimatePresence mode="popLayout">
        {buses.length > 0 ? (
          <div className="space-y-3">
            {buses.map((bus, index) => (
              <motion.div
                key={bus.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
                          <BusIcon className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{bus.name}</h3>
                          <p className="text-xs text-muted-foreground">{bus.plateNumber}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(bus)}>
                          <Edit className="w-4 h-4 text-gray-500" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(bus.id)}>
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{bus.routeName}: {bus.routeStart} → {bus.routeEnd}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Users className="w-3.5 h-3.5" />
                        <span>Capacity: {bus.capacity} seats</span>
                      </div>
                    </div>

                    {/* Route Preview */}
                    {bus.routeName && (
                      <div className="mt-3 bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <MapPin className="w-3 h-3 text-emerald-500" />
                          <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Route Preview</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col items-center">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                            <div className="w-0.5 h-6 bg-gray-300 dark:bg-gray-600" />
                            <div className="w-2 h-2 bg-red-500 rounded-full" />
                          </div>
                          <div className="flex flex-col gap-3">
                            <span className="text-xs font-medium text-gray-900 dark:text-gray-100">{bus.routeStart || 'Start'}</span>
                            <span className="text-[10px] text-muted-foreground">{bus.routeName}</span>
                            <span className="text-xs font-medium text-gray-900 dark:text-gray-100">{bus.routeEnd || 'End'}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {bus.driver?.name || 'No driver assigned'}
                      </Badge>
                      <Badge className={`text-[10px] ${bus.active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        {bus.active ? 'Active' : 'Inactive'}
                      </Badge>
                      {bus.id && busLocations[bus.id]?.isLive ? (
                        <Badge className="text-[10px] bg-emerald-100 text-emerald-700 flex items-center gap-1">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                          </span>
                          Live
                        </Badge>
                      ) : (
                        <Badge className="text-[10px] bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                          Offline
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <BusIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No buses yet. Add your first bus!</p>
          </div>
        )}
      </AnimatePresence>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingBus ? 'Edit Bus' : 'Add New Bus'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Bus Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Morning Express"
                className="h-10 rounded-xl"
              />
            </div>
            <div>
              <Label className="text-xs">Plate Number *</Label>
              <Input
                value={form.plateNumber}
                onChange={(e) => setForm({ ...form, plateNumber: e.target.value })}
                placeholder="e.g. WP CAR-1234"
                className="h-10 rounded-xl"
              />
            </div>
            <div>
              <Label className="text-xs">Capacity *</Label>
              <Input
                type="number"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                placeholder="e.g. 52"
                className="h-10 rounded-xl"
              />
            </div>
            <div>
              <Label className="text-xs">Route Name</Label>
              <Input
                value={form.routeName}
                onChange={(e) => setForm({ ...form, routeName: e.target.value })}
                placeholder="e.g. Colombo - Kandy"
                className="h-10 rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Route Start</Label>
                <Input
                  value={form.routeStart}
                  onChange={(e) => setForm({ ...form, routeStart: e.target.value })}
                  placeholder="Colombo"
                  className="h-10 rounded-xl"
                />
              </div>
              <div>
                <Label className="text-xs">Route End</Label>
                <Input
                  value={form.routeEnd}
                  onChange={(e) => setForm({ ...form, routeEnd: e.target.value })}
                  placeholder="Kandy"
                  className="h-10 rounded-xl"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Route Stops (comma-separated)</Label>
              <Input
                value={form.routeStops}
                onChange={(e) => setForm({ ...form, routeStops: e.target.value })}
                placeholder="e.g. Kadawatha, Nittambuwa, Kegalle"
                className="h-10 rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button onClick={handleSubmit} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
              {editingBus ? 'Update' : 'Add Bus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
