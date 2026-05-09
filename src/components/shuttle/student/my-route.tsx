'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Bus as BusIcon, Phone, User, ChevronRight } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function MyRoute() {
  const { currentUser, studentDashboard, setStudentDashboard, buses } = useAppStore()
  const [loading, setLoading] = useState(!studentDashboard)

  const loadDashboard = useCallback(async () => {
    if (!currentUser || studentDashboard) return
    try {
      const res = await fetch(`/api/dashboard?userId=${currentUser.id}&role=STUDENT`)
      if (res.ok) {
        const data = await res.json()
        setStudentDashboard(data)
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [currentUser, studentDashboard, setStudentDashboard])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="h-8 bg-gray-100 rounded-lg animate-pulse w-32" />
        <div className="h-48 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    )
  }

  const bus = studentDashboard?.bus || buses[0]
  const subscription = studentDashboard?.subscription
  const driver = bus?.driver

  const stops = bus?.routeStops ? bus.routeStops.split(',').map(s => s.trim()) : []

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold text-gray-900">My Route</h2>

      {/* Bus Details */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 bg-emerald-50 rounded-xl flex items-center justify-center">
                <BusIcon className="w-7 h-7 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg">{bus?.name || 'N/A'}</h3>
                <p className="text-sm text-muted-foreground">{bus?.plateNumber || ''}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-gray-50 rounded-lg p-2">
                <span className="text-muted-foreground">Route</span>
                <p className="font-semibold">{bus?.routeName || 'N/A'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2">
                <span className="text-muted-foreground">Capacity</span>
                <p className="font-semibold">{bus?.capacity || 0} seats</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2">
                <span className="text-muted-foreground">Payment</span>
                <p className="font-semibold">{subscription?.paymentType === 'MONTHLY' ? 'Monthly' : 'Daily'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2">
                <span className="text-muted-foreground">Status</span>
                <Badge className={`text-[9px] px-1.5 py-0 ${bus?.active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                  {bus?.active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Route Visualization */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Route Map</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="relative pl-6">
              {/* Start */}
              <div className="flex items-center gap-3 mb-1">
                <div className="absolute left-0 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-700">{bus?.routeStart || 'Start'}</p>
                  <p className="text-[10px] text-muted-foreground">Departure</p>
                </div>
              </div>

              {/* Line */}
              <div className="absolute left-[7px] top-5 bottom-5 w-0.5 bg-emerald-200" />

              {/* Stops */}
              {stops.map((stop, i) => (
                <div key={i} className="flex items-center gap-3 mb-1 relative">
                  <div className="absolute left-0 w-3 h-3 bg-emerald-200 rounded-full" />
                  <div className="flex items-center gap-1 ml-1">
                    <ChevronRight className="w-3 h-3 text-emerald-400" />
                    <span className="text-xs text-muted-foreground">{stop}</span>
                  </div>
                </div>
              ))}

              {/* End */}
              <div className="flex items-center gap-3 mt-1">
                <div className="absolute left-0 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-red-700">{bus?.routeEnd || 'End'}</p>
                  <p className="text-[10px] text-muted-foreground">Destination</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Driver Info */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Driver</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold">{driver?.name || 'No driver assigned'}</p>
                {driver?.phone && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="w-3 h-3" />
                    {driver.phone}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
