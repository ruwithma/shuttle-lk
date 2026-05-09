'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Bus as BusIcon, Phone, User, Wifi, WifiOff, Clock, Navigation, Crosshair } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import BusMap from '@/components/shuttle/shared/bus-map'
import { useBusLocation } from '@/components/shuttle/shared/bus-location-hook'
import { formatDistanceToNow } from 'date-fns'

// Calculate ETA between bus and student's stop
function calculateETA(
  busLat: number,
  busLng: number,
  stopLat: number,
  stopLng: number,
  speedKmh: number | null | undefined
): string | null {
  const R = 6371000
  const dLat = (stopLat - busLat) * Math.PI / 180
  const dLng = (stopLng - busLng) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(busLat * Math.PI / 180) * Math.cos(stopLat * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distMeters = R * c

  if (speedKmh && speedKmh > 5) {
    const speedMs = speedKmh / 3.6
    const etaSeconds = distMeters / speedMs
    if (etaSeconds < 60) return '< 1 min'
    if (etaSeconds < 3600) return `${Math.round(etaSeconds / 60)} min`
    return `${Math.floor(etaSeconds / 3600)}h ${Math.round((etaSeconds % 3600) / 60)}m`
  }

  // Average Sri Lanka bus speed (25 km/h)
  const avgSpeedMs = 25 / 3.6
  const etaSeconds = distMeters / avgSpeedMs
  if (distMeters < 500) return '< 2 min'
  if (etaSeconds < 60) return '< 1 min'
  if (etaSeconds < 3600) return `~${Math.round(etaSeconds / 60)} min`
  return `~${Math.floor(etaSeconds / 3600)}h ${Math.round((etaSeconds % 3600) / 60)}m`
}

export default function MyRoute() {
  const { currentUser, studentDashboard, setStudentDashboard, buses } = useAppStore()
  const [loading, setLoading] = useState(!studentDashboard)
  const [followBus, setFollowBus] = useState(true) // Camera follow toggle

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

  // Live bus location tracking with interpolation
  const { location, isLive, trail, connected, interpolatedPosition } = useBusLocation(bus?.id ?? null)

  // Parse route coordinates and stops
  const routePath = useMemo<[number, number][]>(() => {
    try {
      const coords = JSON.parse(bus?.routeCoordinates || '[]')
      if (Array.isArray(coords) && coords.length > 0) {
        return coords.map((c: [number, number]) => [c[0], c[1]] as [number, number])
      }
    } catch {}
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
    } catch {}
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

  // Find the student's stop (middle stop)
  const studentStop = useMemo(() => {
    if (stops.length === 0) return null
    const midIdx = Math.floor(stops.length / 2)
    return stops[midIdx]
  }, [stops])

  // Calculate ETA
  const eta = useMemo(() => {
    if (!location || !studentStop || !isLive) return null
    return calculateETA(location.lat, location.lng, studentStop.lat, studentStop.lng, location.speed)
  }, [location, studentStop, isLive])

  // Distance to student stop
  const distanceToStop = useMemo(() => {
    if (!location || !studentStop) return null
    const R = 6371000
    const dLat = (studentStop.lat - location.lat) * Math.PI / 180
    const dLng = (studentStop.lng - location.lng) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(location.lat * Math.PI / 180) * Math.cos(studentStop.lat * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }, [location, studentStop])

  // Calculate route progress percentage (dynamic, not hardcoded!)
  const routeProgress = useMemo(() => {
    if (!location || !routePath || routePath.length < 2) return 0
    let closestIdx = 0
    let closestDist = Infinity
    for (let i = 0; i < routePath.length; i++) {
      const d = Math.sqrt(
        Math.pow(routePath[i][0] - location.lat, 2) +
        Math.pow(routePath[i][1] - location.lng, 2)
      )
      if (d < closestDist) {
        closestDist = d
        closestIdx = i
      }
    }
    return Math.round((closestIdx / (routePath.length - 1)) * 100)
  }, [location, routePath])

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

      {/* ETA Card - Uber-style prominent display */}
      {isLive && eta && studentStop && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 text-white overflow-hidden relative">
            <div className="absolute -top-6 -right-6 w-28 h-28 bg-white/10 rounded-full" />
            <div className="absolute -bottom-3 -left-3 w-16 h-16 bg-white/5 rounded-full" />
            <CardContent className="p-5 relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Navigation className="w-4 h-4" />
                    <span className="text-sm font-bold text-emerald-100 uppercase tracking-wider">Bus on the way</span>
                  </div>
                  <p className="text-4xl font-black">{eta}</p>
                  <p className="text-xs text-emerald-200 mt-1">
                    to {studentStop.name}
                    {distanceToStop && ` · ${(distanceToStop / 1000).toFixed(1)} km away`}
                  </p>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
                    <span className="text-3xl font-black">{location?.speed ? Math.round(location.speed) : '--'}</span>
                  </div>
                  <span className="text-[10px] text-emerald-200 mt-1 font-semibold">km/h</span>
                </div>
              </div>
              {/* Dynamic progress bar */}
              <div className="mt-4">
                <div className="flex justify-between text-[10px] font-bold text-emerald-200 mb-1.5">
                  <span>{bus?.routeStart || 'Start'}</span>
                  <span>{routeProgress}%</span>
                  <span>{bus?.routeEnd || 'End'}</span>
                </div>
                <div className="bg-white/20 rounded-full h-2.5 overflow-hidden">
                  <motion.div
                    className="bg-white rounded-full h-2.5"
                    initial={{ width: '0%' }}
                    animate={{ width: `${routeProgress}%` }}
                    transition={{ duration: 2, ease: 'easeOut' }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Map Section with Camera Follow Toggle */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: isLive ? 0.1 : 0 }}>
        <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Live Route Map</CardTitle>
              {isLive && (
                <Button
                  variant={followBus ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFollowBus(!followBus)}
                  className={`rounded-lg text-[10px] h-7 px-2.5 ${
                    followBus
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'text-gray-500'
                  }`}
                >
                  <Crosshair className="w-3 h-3 mr-1" />
                  {followBus ? 'Following' : 'Follow Bus'}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0 pb-0">
            <div style={{ height: 320, maxHeight: 420 }}>
              <BusMap
                routePath={routePath}
                stops={stops}
                busLocation={busLocation}
                trail={trailPoints}
                showLiveBus={isLive}
                interpolatedPosition={interpolatedPosition}
                studentStop={studentStop}
                eta={eta}
                followBus={followBus && isLive}
                className="rounded-none"
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Bus Details */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
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
                <Badge className="bg-emerald-50 text-emerald-700 text-[10px] px-2.5 py-0.5 animate-pulse font-bold">
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

      {/* Live Tracking Indicator */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
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
                      Updated {lastUpdatedText}
                      {location?.speed != null && ` · ${Math.round(location.speed)} km/h`}
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
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
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
