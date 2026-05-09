'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Bus as BusIcon, CreditCard, HandCoins, Radio, CircleOff, Navigation, Gauge } from 'lucide-react'
import { useSharedSocket } from '@/components/shuttle/shared/socket-provider'
import { useAppStore } from '@/lib/store'
import { fetchDashboardData, isCacheFresh } from '@/lib/data-fetcher'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import RefreshIndicator from '@/components/shuttle/shared/refresh-indicator'
import { format } from 'date-fns'
import type { DriverDashboard as DriverDashboardType } from '@/lib/types'

const formatLKR = (amount: number) => `Rs. ${amount.toLocaleString()}`

export default function DriverDashboard() {
  const { currentUser, driverDashboard, setDriverDashboard, isDriverLive, setIsDriverLive } = useAppStore()
  const { socket, connected } = useSharedSocket()
  const [loading, setLoading] = useState(!driverDashboard || !isCacheFresh('DRIVER'))
  const [refreshing, setRefreshing] = useState(false)
  const [simulationMode, setSimulationMode] = useState(false)
  const [currentSpeed, setCurrentSpeed] = useState<number | null>(null)
  const [currentHeading, setCurrentHeading] = useState<number | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const simIndexRef = useRef(0)

  useEffect(() => {
    loadDashboard()
  }, [currentUser])

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (!currentUser) return
    if (isRefresh) {
      setRefreshing(true)
    } else if (!driverDashboard || !isCacheFresh('DRIVER')) {
      setLoading(true)
    }
    try {
      const data = await fetchDashboardData<DriverDashboardType>(currentUser.id, 'DRIVER')
      if (data) {
        setDriverDashboard(data)
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [currentUser, setDriverDashboard, driverDashboard])

  const data = driverDashboard || {
    todayCollection: 0,
    bus: { id: '', plateNumber: '', name: 'No bus assigned', capacity: 0, routeName: '', routeStart: '', routeEnd: '', routeStops: '', ownerId: '', active: false },
    todayPayments: [],
  }

  const bus = data.bus

  // Parse route coordinates for simulation
  const routeCoords = useMemo(() => {
    try {
      const coords = JSON.parse(bus?.routeCoordinates || '[]')
      if (Array.isArray(coords) && coords.length > 0) {
        return coords.map((c: [number, number]) => [c[0], c[1]] as [number, number])
      }
    } catch {}
    return []
  }, [bus?.routeCoordinates])

  const startLive = useCallback(() => {
    if (!bus?.id || !currentUser) return

    setIsDriverLive(true)

    // Emit driver-start when connected
    if (socket?.connected) {
      socket.emit('driver-start', {
        busId: bus.id,
        ownerId: bus.ownerId,
        driverName: currentUser.name,
        busName: bus.name,
        routeName: bus.routeName,
        routeStart: bus.routeStart,
        routeEnd: bus.routeEnd,
        plateNumber: bus.plateNumber,
      })
    }

    // Try real geolocation first
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setSimulationMode(false)
          const lat = pos.coords.latitude
          const lng = pos.coords.longitude
          const speed = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : null
          const heading = pos.coords.heading ? Math.round(pos.coords.heading) : null
          setCurrentSpeed(speed)
          setCurrentHeading(heading)

          socket?.emit('driver-location', {
            busId: bus.id,
            lat,
            lng,
            speed,
            heading,
          })

          fetch('/api/locations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ busId: bus.id, lat, lng, speed, heading, driverId: currentUser.id }),
          }).catch(() => {})
        },
        () => {
          setSimulationMode(true)
        },
        { enableHighAccuracy: true, timeout: 5000 }
      )
    } else {
      setSimulationMode(true)
    }

    // Start interval for continuous updates (2s for smoother tracking)
    intervalRef.current = setInterval(() => {
      if (simulationMode || !('geolocation' in navigator)) {
        // Simulation mode - move along route
        if (routeCoords.length < 2) return

        simIndexRef.current = (simIndexRef.current + 1) % (routeCoords.length * 2)
        const progress = simIndexRef.current / 2
        const idx = Math.floor(progress) % routeCoords.length
        const nextIdx = (idx + 1) % routeCoords.length
        const frac = progress - Math.floor(progress)

        const lat = routeCoords[idx][0] + (routeCoords[nextIdx][0] - routeCoords[idx][0]) * frac
        const lng = routeCoords[idx][1] + (routeCoords[nextIdx][1] - routeCoords[idx][1]) * frac

        const simSpeed = Math.round(20 + Math.random() * 40)
        const dLat = routeCoords[nextIdx][0] - routeCoords[idx][0]
        const dLng = routeCoords[nextIdx][1] - routeCoords[idx][1]
        const simHeading = Math.round((Math.atan2(dLng, dLat) * 180) / Math.PI)

        setCurrentSpeed(simSpeed)
        setCurrentHeading(simHeading)

        if (socket?.connected) {
          socket.emit('driver-location', {
            busId: bus.id,
            lat,
            lng,
            speed: simSpeed,
            heading: simHeading,
          })
        }

        fetch('/api/locations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ busId: bus.id, lat, lng, speed: simSpeed, heading: simHeading, driverId: currentUser.id }),
        }).catch(() => {})
      } else {
        // Real GPS mode
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude
            const lng = pos.coords.longitude
            const speed = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : null
            const heading = pos.coords.heading ? Math.round(pos.coords.heading) : null
            setCurrentSpeed(speed)
            setCurrentHeading(heading)

            if (socket?.connected) {
              socket.emit('driver-location', {
                busId: bus.id,
                lat,
                lng,
                speed,
                heading,
              })
            }

            fetch('/api/locations', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ busId: bus.id, lat, lng, speed, heading, driverId: currentUser.id }),
            }).catch(() => {})
          },
          () => {
            setSimulationMode(true)
          },
          { enableHighAccuracy: true, timeout: 5000 }
        )
      }
    }, 2000)
  }, [bus, currentUser, setIsDriverLive, socket, simulationMode, routeCoords])

  const stopLive = useCallback(() => {
    if (socket?.connected) {
      socket.emit('driver-stop', {
        busId: bus?.id,
        ownerId: bus?.ownerId,
      })
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setIsDriverLive(false)
    setSimulationMode(false)
    setCurrentSpeed(null)
    setCurrentHeading(null)
    simIndexRef.current = 0
  }, [bus?.id, bus?.ownerId, setIsDriverLive, socket])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="h-8 bg-gray-100 rounded-lg animate-pulse w-48" />
        <div className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
        <div className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    )
  }

  const greeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const dailyCount = data.todayPayments.filter(p => p.paymentType === 'DAILY').length
  const monthlyCount = data.todayPayments.filter(p => p.paymentType === 'MONTHLY').length

  return (
    <div className="relative">
      <RefreshIndicator loading={refreshing} />
      <div className="p-4 space-y-4">
        {/* Welcome */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-xl font-bold text-gray-900">
            {greeting()}, {currentUser?.name?.split(' ')[0]}!
          </h2>
          <p className="text-sm text-muted-foreground">Ready for today&apos;s collections?</p>
        </motion.div>

        {/* Go Live Toggle Card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className={`rounded-2xl border-0 shadow-sm ${isDriverLive ? 'bg-emerald-50' : 'bg-gray-50'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isDriverLive ? (
                    <div className="relative flex items-center justify-center">
                      <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
                        <Radio className="w-5 h-5 text-white" />
                      </div>
                      <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 bg-gray-300 rounded-xl flex items-center justify-center">
                      <CircleOff className="w-5 h-5 text-gray-500" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {isDriverLive ? 'You are LIVE' : 'Go Live'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isDriverLive
                        ? simulationMode
                          ? 'Simulation mode · Sharing location'
                          : 'Sharing your GPS location'
                        : 'Share your location with students & owner'}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={isDriverLive ? stopLive : startLive}
                  className={`rounded-xl text-sm font-semibold ${
                    isDriverLive
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {isDriverLive ? 'Stop' : 'Go Live'}
                </Button>
              </div>

              {/* Speed and heading card when live */}
              {isDriverLive && (currentSpeed !== null || currentHeading !== null) && (
                <div className="mt-3 flex gap-2">
                  {currentSpeed !== null && (
                    <div className="flex items-center gap-1.5 bg-white rounded-lg px-3 py-1.5 shadow-sm">
                      <Gauge className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-xs font-semibold text-gray-900">{currentSpeed} km/h</span>
                    </div>
                  )}
                  {currentHeading !== null && (
                    <div className="flex items-center gap-1.5 bg-white rounded-lg px-3 py-1.5 shadow-sm">
                      <Navigation className="w-3.5 h-3.5 text-emerald-600" style={{ transform: `rotate(${currentHeading}deg)` }} />
                      <span className="text-xs font-semibold text-gray-900">{currentHeading}°</span>
                    </div>
                  )}
                  {simulationMode && (
                    <div className="flex items-center gap-1.5 bg-amber-50 rounded-lg px-3 py-1.5">
                      <span className="text-xs font-medium text-amber-700">Demo</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Bus Card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="rounded-2xl border-0 shadow-sm bg-emerald-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center">
                  <BusIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{bus.name}</h3>
                  <p className="text-xs text-muted-foreground">{bus.plateNumber}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Route:</span>
                  <span className="font-medium">{bus.routeName || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Capacity:</span>
                  <span className="font-medium">{bus.capacity} seats</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Today's Collection */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">Today&apos;s Collection</p>
              <p className="text-3xl font-bold text-emerald-600 mt-1">{formatLKR(data.todayCollection)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {data.todayPayments.length} payment{data.todayPayments.length !== 1 ? 's' : ''} collected
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Stats */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <div className="grid grid-cols-2 gap-3">
            <Card className="rounded-2xl border-0 shadow-sm">
              <CardContent className="p-3 text-center">
                <HandCoins className="w-5 h-5 text-amber-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-gray-900">{dailyCount}</p>
                <p className="text-[10px] text-muted-foreground">Daily Payments</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-0 shadow-sm">
              <CardContent className="p-3 text-center">
                <CreditCard className="w-5 h-5 text-purple-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-gray-900">{monthlyCount}</p>
                <p className="text-[10px] text-muted-foreground">Monthly Payments</p>
              </CardContent>
            </Card>
          </div>
        </motion.div>

        {/* Today's Payments */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Today&apos;s Payments</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              {data.todayPayments.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {data.todayPayments.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center">
                          <span className="text-[10px] font-semibold text-emerald-700">
                            {payment.student?.name?.charAt(0) || 'S'}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">{payment.student?.name || 'Student'}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {format(new Date(payment.date), 'h:mm a')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatLKR(payment.amount)}</p>
                        <Badge className={`text-[9px] px-1.5 py-0 ${payment.paymentMethod === 'CASH' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
                          {payment.paymentMethod === 'CASH' ? 'Cash' : 'Bank'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No payments collected today</p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
