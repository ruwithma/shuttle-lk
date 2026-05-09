'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Bus as BusIcon, MapPin } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import ShuttleMap from '@/components/shuttle/shared/shuttle-map-wrapper'
import { useFleetLocations } from '@/components/shuttle/shared/bus-location-hook'
import { formatDistanceToNow } from 'date-fns'

const BUS_COLORS = ['#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#3b82f6', '#ec4899']

export default function FleetTracking() {
  const { currentUser, buses, setBuses } = useAppStore()
  const { locations, loading } = useFleetLocations(currentUser?.id ?? null)

  // Load buses if not already loaded
  useMemo(() => {
    if (!currentUser || buses.length > 0) return
    fetch(`/api/buses?ownerId=${currentUser.id}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) {
          useAppStore.getState().setBuses(data)
        }
      })
      .catch(() => {})
  }, [currentUser, buses.length])

  const fleetBuses = useMemo(() => {
    if (!locations || locations.length === 0) return []
    return locations.map((loc, index) => ({
      busId: loc.busId,
      busName: loc.busName,
      plateNumber: loc.plateNumber,
      lat: loc.lat,
      lng: loc.lng,
      heading: loc.heading ?? undefined,
      speed: loc.speed ?? undefined,
      isLive: loc.isLive,
      lastUpdate: loc.timestamp
        ? formatDistanceToNow(new Date(loc.timestamp), { addSuffix: true })
        : undefined,
      color: BUS_COLORS[index % BUS_COLORS.length],
    }))
  }, [locations])

  const liveCount = locations.filter((l) => l.isLive).length

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse w-48" />
        <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
        <div className="h-20 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Fleet Tracking</h2>
        <div className="flex items-center gap-2">
          <Badge className={`text-[10px] ${liveCount > 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
            {liveCount}/{locations.length} Live
          </Badge>
        </div>
      </div>

      {/* Map */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="rounded-2xl border-0 shadow-sm dark:bg-gray-900 overflow-hidden">
          <div style={{ height: 350, maxHeight: 400 }}>
            <ShuttleMap
              fleetBuses={fleetBuses}
              center={[7.0, 79.9]}
              zoom={10}
              showLiveBus={false}
              className="rounded-none"
            />
          </div>
        </Card>
      </motion.div>

      {/* Bus List */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="rounded-2xl border-0 shadow-sm dark:bg-gray-900">
          <div className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">All Buses</h3>
            {locations.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {locations.map((loc, index) => {
                  const busColor = BUS_COLORS[index % BUS_COLORS.length]
                  return (
                    <div key={loc.busId} className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: `${busColor}15` }}
                      >
                        <BusIcon className="w-5 h-5" style={{ color: busColor }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{loc.busName}</p>
                          {loc.isLive ? (
                            <div className="flex items-center gap-1">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                              </span>
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Live</span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-gray-400 font-medium">Offline</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{loc.plateNumber} · {loc.routeName}</p>
                        {loc.timestamp && (
                          <p className="text-[10px] text-muted-foreground">
                            {loc.isLive ? 'Updated' : 'Last seen'} {formatDistanceToNow(new Date(loc.timestamp), { addSuffix: true })}
                          </p>
                        )}
                      </div>
                      <MapPin className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No buses found</p>
            )}
          </div>
        </Card>
      </motion.div>
    </div>
  )
}
