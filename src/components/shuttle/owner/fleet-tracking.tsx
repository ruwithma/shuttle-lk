'use client'

import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Bus as BusIcon, MapPin, Wifi, WifiOff, ChevronRight } from 'lucide-react'
import { io, Socket } from 'socket.io-client'
import { useAppStore } from '@/lib/store'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import BusMap from '@/components/shuttle/shared/bus-map'
import { formatDistanceToNow } from 'date-fns'

interface BusLocationData {
  busId: string
  busName: string
  plateNumber: string
  lat: number
  lng: number
  speed: number | null
  heading: number | null
  timestamp: string | null
  routeName: string
  isLive: boolean
}

const BUS_COLORS = ['#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#3b82f6', '#ec4899']

export default function FleetTracking() {
  const { currentUser, buses, setBuses } = useAppStore()
  const [locations, setLocations] = useState<BusLocationData[]>([])
  const [loading, setLoading] = useState(true)
  const socketRef = useRef<Socket | null>(null)

  // Load buses if not already loaded
  useEffect(() => {
    if (!currentUser || buses.length > 0) return
    fetch(`/api/buses?ownerId=${currentUser.id}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setBuses(data)
      })
      .catch(() => {})
  }, [currentUser, buses.length, setBuses])

  // Fetch initial locations
  useEffect(() => {
    if (!currentUser) return
    let cancelled = false

    fetch(`/api/locations?ownerId=${currentUser.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        if (data.locations && Array.isArray(data.locations)) {
          setLocations(data.locations)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    return () => {
      cancelled = true
    }
  }, [currentUser])

  // Socket.IO subscription for live updates
  useEffect(() => {
    if (!currentUser) return

    const socket = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('subscribe-owner', { ownerId: currentUser.id })
    })

    socket.on('bus-location', (data: {
      busId: string
      lat: number
      lng: number
      speed?: number
      heading?: number
      timestamp?: string
    }) => {
      setLocations((prev) =>
        prev.map((loc) =>
          loc.busId === data.busId
            ? {
                ...loc,
                lat: data.lat,
                lng: data.lng,
                speed: data.speed ?? null,
                heading: data.heading ?? null,
                timestamp: data.timestamp ?? new Date().toISOString(),
                isLive: true,
              }
            : loc
        )
      )
    })

    socket.on('driver-started', (data: { busId: string; driverName: string; busName: string }) => {
      setLocations((prev) =>
        prev.map((loc) =>
          loc.busId === data.busId ? { ...loc, isLive: true } : loc
        )
      )
    })

    socket.on('driver-stopped', (data: { busId: string }) => {
      setLocations((prev) =>
        prev.map((loc) =>
          loc.busId === data.busId ? { ...loc, isLive: false } : loc
        )
      )
    })

    return () => {
      socket.emit('unsubscribe-owner', { ownerId: currentUser.id })
      socket.disconnect()
    }
  }, [currentUser])

  // Build fleet buses for map
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
        <div className="h-8 bg-gray-100 rounded-lg animate-pulse w-48" />
        <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
        <div className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Fleet Tracking</h2>
        <div className="flex items-center gap-2">
          <Badge className={`text-[10px] ${liveCount > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
            {liveCount}/{locations.length} Live
          </Badge>
        </div>
      </div>

      {/* Map */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
          <div style={{ height: 350, maxHeight: 400 }}>
            <BusMap
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
        <Card className="rounded-2xl border-0 shadow-sm">
          <div className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">All Buses</h3>
            {locations.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {locations.map((loc, index) => {
                  const busColor = BUS_COLORS[index % BUS_COLORS.length]
                  return (
                    <div key={loc.busId} className="flex items-center gap-3 p-2 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: `${busColor}20` }}
                      >
                        <BusIcon className="w-5 h-5" style={{ color: busColor }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900 truncate">{loc.busName}</p>
                          {loc.isLive ? (
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                              <span className="text-[10px] text-emerald-600 font-medium">Live</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 bg-gray-400 rounded-full" />
                              <span className="text-[10px] text-gray-400 font-medium">Offline</span>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{loc.plateNumber} · {loc.routeName}</p>
                        {loc.timestamp && (
                          <p className="text-[10px] text-muted-foreground">
                            {loc.isLive ? 'Updated' : 'Last seen'} {formatDistanceToNow(new Date(loc.timestamp), { addSuffix: true })}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
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
