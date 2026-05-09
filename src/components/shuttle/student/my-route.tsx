'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Bus as BusIcon, Phone, User, Wifi, WifiOff } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import BusMap from '@/components/shuttle/shared/bus-map'
import { useBusLocation } from '@/components/shuttle/shared/bus-location-hook'
import { formatDistanceToNow } from 'date-fns'

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

  const bus = studentDashboard?.bus || buses[0]
  const subscription = studentDashboard?.subscription
  const driver = bus?.driver

  // Live bus location tracking
  const { location, isLive, trail, connected } = useBusLocation(bus?.id ?? null)

  // Parse route coordinates and stops
  const routePath = useMemo<[number, number][]>(() => {
    try {
      const coords = JSON.parse(bus?.routeCoordinates || '[]')
      if (Array.isArray(coords) && coords.length > 0) {
        return coords.map((c: [number, number]) => [c[0], c[1]] as [number, number])
      }
    } catch {
      // ignore parse errors
    }
    return []
  }, [bus?.routeCoordinates])

  const stops = useMemo<{ name: string; lat: number; lng: number }[]>(() => {
    try {
      const stopCoords = JSON.parse(bus?.routeStopCoordinates || '{}')
      if (typeof stopCoords === 'object' && Object.keys(stopCoords).length > 0) {
        return Object.entries(stopCoords).map(([name, coord]) => {
          const c = coord as [number, number]
          return { name, lat: c[0], lng: c[1] }
        })
      }
    } catch {
      // ignore parse errors
    }
    return []
  }, [bus?.routeStopCoordinates])

  const busLocation = useMemo(() => {
    if (!location) return undefined
    return {
      lat: location.lat,
      lng: location.lng,
      heading: location.heading ?? undefined,
      speed: location.speed ?? undefined,
    }
  }, [location])

  const trailPoints = useMemo(() => {
    if (!trail || trail.length === 0) return undefined
    return trail.map((t) => ({ lat: t.lat, lng: t.lng }))
  }, [trail])

  // Calculate time since last update
  const lastUpdatedText = useMemo(() => {
    if (!location?.timestamp) return 'Unknown'
    try {
      return formatDistanceToNow(new Date(location.timestamp), { addSuffix: true })
    } catch {
      return 'Unknown'
    }
  }, [location?.timestamp])

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="h-8 bg-gray-100 rounded-lg animate-pulse w-32" />
        <div className="h-48 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    )
  }

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
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 text-lg">{bus?.name || 'N/A'}</h3>
                <p className="text-sm text-muted-foreground">{bus?.plateNumber || ''}</p>
              </div>
              {isLive && (
                <Badge className="bg-emerald-50 text-emerald-700 text-[10px] px-2 py-0.5 animate-pulse">
                  LIVE
                </Badge>
              )}
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

      {/* Map Section */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Live Route Map</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pb-0">
            <div style={{ height: 300, maxHeight: 400 }}>
              <BusMap
                routePath={routePath}
                stops={stops}
                busLocation={busLocation}
                trail={trailPoints}
                showLiveBus={isLive}
                className="rounded-none"
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Live Tracking Indicator */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              {isLive ? (
                <>
                  <div className="relative flex items-center justify-center">
                    <div className="w-3 h-3 bg-emerald-500 rounded-full" />
                    <div className="absolute w-3 h-3 bg-emerald-500 rounded-full animate-ping" />
                  </div>
                  <Wifi className="w-4 h-4 text-emerald-600" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-emerald-700">Bus is live</p>
                    <p className="text-xs text-muted-foreground">
                      Last updated {lastUpdatedText}
                      {location?.speed != null && ` · Speed: ${Math.round(location.speed)} km/h`}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-3 h-3 bg-gray-400 rounded-full" />
                  <WifiOff className="w-4 h-4 text-gray-400" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-500">Bus is offline</p>
                    <p className="text-xs text-muted-foreground">
                      Last seen: {lastUpdatedText}
                    </p>
                  </div>
                </>
              )}
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
