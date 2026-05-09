'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, MapPin, Users, Bus as BusIcon, Clock, ChevronRight,
  Navigation, Sparkles, X, Wifi, WifiOff, ArrowRight, Star,
  LocateFixed, Radio,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import ShuttleMap from '@/components/shuttle/shared/shuttle-map-wrapper'
import { useSharedSocket } from '@/components/shuttle/shared/socket-provider'
import { formatLKR } from '@/lib/utils'

interface ShuttleResult {
  id: string
  name: string
  plateNumber: string
  capacity: number
  routeName: string
  routeStart: string
  routeEnd: string
  stops: string[]
  routeCoordinates: [number, number][]
  routeStopCoordinates: string
  currentLat: number | null
  currentLng: number | null
  isLive: boolean
  driver: { id: string; name: string; phone: string } | null
  owner: { id: string; name: string }
  activeSubscriptions: number
  occupancyPercent: number
  priceRange: {
    daily: { min: number; max: number } | null
    monthly: { min: number; max: number } | null
  }
  seatsAvailable: number
}

// Live bus from WebSocket
interface LiveBusFromSocket {
  busId: string
  lat: number
  lng: number
  speed?: number
  heading?: number
  busName?: string
  routeName?: string
  plateNumber?: string
  timestamp: number
}

export default function ShuttleFinder() {
  const { currentUser } = useAppStore()
  const { getSocket, connected } = useSharedSocket()
  const [query, setQuery] = useState('')
  const [shuttles, setShuttles] = useState<ShuttleResult[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedShuttle, setSelectedShuttle] = useState<ShuttleResult | null>(null)
  const [popularAreas, setPopularAreas] = useState<string[]>([])
  const [usingLocation, setUsingLocation] = useState(false)
  const [liveBusesFromSocket, setLiveBusesFromSocket] = useState<Map<string, LiveBusFromSocket>>(new Map())
  const [showLiveMap, setShowLiveMap] = useState(false)

  // Subscribe to all live buses for the real-time map
  useEffect(() => {
    const socket = getSocket()
    if (!socket || !connected) return

    const onConnect = () => {
      socket.emit('subscribe-all-live')
    }

    if (socket.connected) {
      onConnect()
    }

    socket.on('connect', onConnect)

    socket.on('all-live-buses', (buses: LiveBusFromSocket[]) => {
      const map = new Map<string, LiveBusFromSocket>()
      buses.forEach(b => map.set(b.busId, b))
      setLiveBusesFromSocket(map)
    })

    socket.on('live-bus-update', (data: LiveBusFromSocket) => {
      setLiveBusesFromSocket(prev => {
        const next = new Map(prev)
        next.set(data.busId, data)
        return next
      })
    })

    socket.on('live-bus-stopped', (data: { busId: string }) => {
      setLiveBusesFromSocket(prev => {
        const next = new Map(prev)
        next.delete(data.busId)
        return next
      })
    })

    return () => {
      socket.off('connect', onConnect)
      socket.off('all-live-buses')
      socket.off('live-bus-update')
      socket.off('live-bus-stopped')
      socket.emit('unsubscribe-all-live')
    }
  }, [getSocket, connected])

  // Fetch all active shuttles on mount
  useEffect(() => {
    fetchShuttles()
  }, [])

  const fetchShuttles = useCallback(async (searchQuery?: string, lat?: number, lng?: number) => {
    setLoading(true)
    try {
      let url = '/api/shuttles?'
      const params = new URLSearchParams()
      if (searchQuery) params.set('q', searchQuery)
      if (lat != null && lng != null) {
        params.set('lat', String(lat))
        params.set('lng', String(lng))
        params.set('radius', '15')
      }
      url += params.toString()

      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setShuttles(data.shuttles || [])
        if (data.popularAreas) setPopularAreas(data.popularAreas)
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSearch = useCallback(() => {
    if (query.trim()) {
      fetchShuttles(query.trim())
    } else {
      fetchShuttles()
    }
  }, [query, fetchShuttles])

  const useMyLocation = useCallback(() => {
    if (!('geolocation' in navigator)) return
    setUsingLocation(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetchShuttles(query.trim(), pos.coords.latitude, pos.coords.longitude)
        setUsingLocation(false)
      },
      () => {
        setUsingLocation(false)
      },
      { enableHighAccuracy: true, timeout: 5000 }
    )
  }, [query, fetchShuttles])

  // Build fleet buses for live map view
  const liveFleetBuses = useMemo(() => {
    const buses: Array<{
      busId: string
      busName: string
      plateNumber: string
      lat: number
      lng: number
      heading?: number
      speed?: number
      isLive: boolean
      color: string
    }> = []

    for (const shuttle of shuttles) {
      const liveData = liveBusesFromSocket.get(shuttle.id)
      if (liveData) {
        buses.push({
          busId: shuttle.id,
          busName: shuttle.name,
          plateNumber: shuttle.plateNumber,
          lat: liveData.lat,
          lng: liveData.lng,
          heading: liveData.heading,
          speed: liveData.speed,
          isLive: true,
          color: '#10b981',
        })
      } else if (shuttle.currentLat && shuttle.currentLng) {
        buses.push({
          busId: shuttle.id,
          busName: shuttle.name,
          plateNumber: shuttle.plateNumber,
          lat: shuttle.currentLat,
          lng: shuttle.currentLng,
          isLive: shuttle.isLive,
          color: shuttle.isLive ? '#10b981' : '#9ca3af',
        })
      }
    }

    return buses
  }, [shuttles, liveBusesFromSocket])

  // Parse route for selected shuttle
  const selectedRoutePath = useMemo<[number, number][]>(() => {
    if (!selectedShuttle) return []
    try {
      const coords = JSON.parse(selectedShuttle.routeCoordinates || '[]')
      if (Array.isArray(coords)) {
        // Handle both [lat, lng] and [lng, lat] formats
        return coords.map((c: [number, number]) => {
          if (c[0] > 90) return [c[1], c[0]] as [number, number] // [lng, lat] -> [lat, lng]
          return [c[0], c[1]] as [number, number]
        })
      }
    } catch {}
    return []
  }, [selectedShuttle])

  const selectedStops = useMemo(() => {
    if (!selectedShuttle) return []
    try {
      const stopCoords = JSON.parse(selectedShuttle.routeStopCoordinates || '{}')
      if (typeof stopCoords === 'object') {
        return Object.entries(stopCoords).map(([name, coord]) => {
          const c = coord as [number, number]
          const isLngFirst = c[0] > 90
          return {
            name,
            lat: isLngFirst ? c[1] : c[0],
            lng: isLngFirst ? c[0] : c[1],
          }
        })
      }
    } catch {}
    return []
  }, [selectedShuttle])

  const selectedLiveBuses = useMemo(() => {
    if (!selectedShuttle) return []
    const liveData = liveBusesFromSocket.get(selectedShuttle.id)
    if (liveData) {
      return [{
        busId: selectedShuttle.id,
        busName: selectedShuttle.name,
        plateNumber: selectedShuttle.plateNumber,
        lat: liveData.lat,
        lng: liveData.lng,
        heading: liveData.heading,
        speed: liveData.speed,
        isLive: true,
        color: '#10b981',
      }]
    }
    if (!selectedShuttle.currentLat || !selectedShuttle.currentLng) return []
    return [{
      busId: selectedShuttle.id,
      busName: selectedShuttle.name,
      plateNumber: selectedShuttle.plateNumber,
      lat: selectedShuttle.currentLat,
      lng: selectedShuttle.currentLng,
      isLive: selectedShuttle.isLive,
      color: '#10b981',
    }]
  }, [selectedShuttle, liveBusesFromSocket])

  const getOccupancyColor = (pct: number) => {
    if (pct >= 90) return 'text-red-600 bg-red-50 dark:bg-red-900/30'
    if (pct >= 70) return 'text-amber-600 bg-amber-50 dark:bg-amber-900/30'
    return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30'
  }

  const liveBusCount = liveBusesFromSocket.size

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="h-12 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map(i => <div key={i} className="h-8 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />)}
        </div>
        {[1, 2, 3].map(i => <div key={i} className="h-28 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />)}
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Find Shuttles</h2>
            <p className="text-sm text-muted-foreground">Discover routes near you</p>
          </div>
          {liveBusCount > 0 && (
            <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 text-[10px] flex items-center gap-1.5 px-2.5 py-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              {liveBusCount} Live
            </Badge>
          )}
        </div>
      </motion.div>

      {/* Search Bar */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search area, route, or stop..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-10 h-11 rounded-xl bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
            />
            {query && (
              <button
                onClick={() => { setQuery(''); fetchShuttles() }}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>
          <Button
            onClick={useMyLocation}
            disabled={usingLocation}
            className="h-11 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {usingLocation ? (
              <LocateFixed className="w-4 h-4 animate-pulse" />
            ) : (
              <Navigation className="w-4 h-4" />
            )}
          </Button>
        </div>
      </motion.div>

      {/* Live Map Toggle */}
      {liveFleetBuses.length > 0 && !selectedShuttle && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <Button
            variant={showLiveMap ? 'default' : 'outline'}
            onClick={() => setShowLiveMap(!showLiveMap)}
            className={`w-full rounded-xl h-10 text-sm font-semibold ${
              showLiveMap
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900/30'
            }`}
          >
            <Radio className="w-4 h-4 mr-2" />
            {showLiveMap ? 'Hide Live Map' : `Show ${liveFleetBuses.length} Buses on Map`}
          </Button>
        </motion.div>
      )}

      {/* Live Map Overview */}
      <AnimatePresence>
        {showLiveMap && !selectedShuttle && liveFleetBuses.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card className="rounded-2xl border-0 shadow-sm dark:bg-gray-900 overflow-hidden">
              <div style={{ height: 280 }}>
                <ShuttleMap
                  fleetBuses={liveFleetBuses}
                  center={[7.0, 79.9]}
                  zoom={10}
                  showLiveBus={false}
                  className="rounded-none"
                />
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Popular Areas */}
      {!selectedShuttle && popularAreas.length > 0 && !query && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Popular Areas</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {popularAreas.slice(0, 8).map((area) => (
              <button
                key={area}
                onClick={() => { setQuery(area); fetchShuttles(area) }}
                className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 hover:border-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:border-emerald-600 dark:hover:text-emerald-400 dark:hover:bg-emerald-900/30 transition-colors"
              >
                {area}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Selected Shuttle Detail View */}
      <AnimatePresence>
        {selectedShuttle && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            {/* Map */}
            <Card className="rounded-2xl border-0 shadow-sm dark:bg-gray-900 overflow-hidden mb-4">
              <div style={{ height: 280 }}>
                <ShuttleMap
                  routePath={selectedRoutePath}
                  stops={selectedStops}
                  fleetBuses={selectedLiveBuses}
                  showLiveBus={false}
                  center={selectedRoutePath.length > 0 ? selectedRoutePath[0] : [7.0, 79.9]}
                  zoom={12}
                  className="rounded-none"
                />
              </div>
            </Card>

            {/* Shuttle Detail Card */}
            <Card className="rounded-2xl border-0 shadow-sm dark:bg-gray-900 mb-4">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/50 rounded-xl flex items-center justify-center">
                      <BusIcon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-gray-100">{selectedShuttle.name}</h3>
                      <p className="text-xs text-muted-foreground">{selectedShuttle.plateNumber}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedShuttle(null)}
                    className="rounded-xl"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {/* Route Info */}
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                    <div className="w-0.5 h-8 bg-gray-300 dark:bg-gray-600" />
                    <div className="w-2.5 h-2.5 bg-red-500 rounded-full" />
                  </div>
                  <div className="flex flex-col gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">From</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{selectedShuttle.routeStart}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">To</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{selectedShuttle.routeEnd}</p>
                    </div>
                  </div>
                </div>

                {/* Stops */}
                {selectedShuttle.stops.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Route Stops</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedShuttle.stops.map((stop, i) => (
                        <span key={i} className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md text-xs font-medium text-gray-600 dark:text-gray-400">
                          {stop}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2.5 text-center">
                    <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mx-auto mb-1" />
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{selectedShuttle.seatsAvailable}</p>
                    <p className="text-[10px] text-muted-foreground">Seats Left</p>
                  </div>
                  <div className={`rounded-xl p-2.5 text-center ${getOccupancyColor(selectedShuttle.occupancyPercent)}`}>
                    <BusIcon className="w-4 h-4 mx-auto mb-1" />
                    <p className="text-sm font-bold">{selectedShuttle.occupancyPercent}%</p>
                    <p className="text-[10px]">Full</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2.5 text-center">
                    {selectedShuttle.isLive || liveBusesFromSocket.has(selectedShuttle.id) ? (
                      <>
                        <Wifi className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Live</p>
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                        <p className="text-sm font-bold text-gray-500 dark:text-gray-400">Offline</p>
                      </>
                    )}
                    <p className="text-[10px] text-muted-foreground">Status</p>
                  </div>
                </div>

                {/* Pricing */}
                {(selectedShuttle.priceRange.daily || selectedShuttle.priceRange.monthly) && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pricing</p>
                    <div className="flex gap-2">
                      {selectedShuttle.priceRange.daily && (
                        <div className="flex-1 bg-amber-50 dark:bg-amber-900/30 rounded-xl p-3 text-center">
                          <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold uppercase">Daily</p>
                          <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
                            Rs. {selectedShuttle.priceRange.daily.min}
                            {selectedShuttle.priceRange.daily.min !== selectedShuttle.priceRange.daily.max &&
                              ` - ${selectedShuttle.priceRange.daily.max}`}
                          </p>
                        </div>
                      )}
                      {selectedShuttle.priceRange.monthly && (
                        <div className="flex-1 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl p-3 text-center">
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase">Monthly</p>
                          <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                            Rs. {selectedShuttle.priceRange.monthly.min}
                            {selectedShuttle.priceRange.monthly.min !== selectedShuttle.priceRange.monthly.max &&
                              ` - ${selectedShuttle.priceRange.monthly.max}`}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Driver Info */}
                {selectedShuttle.driver && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <div className="w-9 h-9 bg-amber-100 dark:bg-amber-900/50 rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold text-amber-700 dark:text-amber-300">
                        {selectedShuttle.driver.name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{selectedShuttle.driver.name}</p>
                      <p className="text-xs text-muted-foreground">{selectedShuttle.driver.phone}</p>
                    </div>
                  </div>
                )}

                {/* Subscribe Button */}
                <Button className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                  <Star className="w-4 h-4 mr-2" />
                  Subscribe to This Shuttle
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shuttle List */}
      {!selectedShuttle && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {shuttles.length} Shuttle{shuttles.length !== 1 ? 's' : ''} Available
            </span>
          </div>

          {shuttles.length > 0 ? (
            <div className="space-y-3">
              {shuttles.map((shuttle, index) => {
                const isActuallyLive = shuttle.isLive || liveBusesFromSocket.has(shuttle.id)
                return (
                  <motion.div
                    key={shuttle.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card
                      className={`rounded-2xl border-0 shadow-sm cursor-pointer hover:shadow-md transition-all dark:bg-gray-900 ${
                        isActuallyLive ? 'ring-1 ring-emerald-200 dark:ring-emerald-800' : ''
                      }`}
                      onClick={() => setSelectedShuttle(shuttle)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            isActuallyLive ? 'bg-emerald-100 dark:bg-emerald-900/50' : 'bg-gray-50 dark:bg-gray-800'
                          }`}>
                            <BusIcon className={`w-5 h-5 ${isActuallyLive ? 'text-emerald-600' : 'text-gray-400'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">{shuttle.name}</h3>
                              {isActuallyLive && (
                                <Badge className="text-[9px] px-1.5 py-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 flex items-center gap-1">
                                  <span className="relative flex h-1.5 w-1.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                                  </span>
                                  Live
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                              <p className="text-xs text-muted-foreground truncate">
                                {shuttle.routeStart} → {shuttle.routeEnd}
                              </p>
                            </div>

                            {/* Bottom row */}
                            <div className="flex items-center gap-3 mt-2">
                              <div className="flex items-center gap-1">
                                <Users className="w-3 h-3 text-gray-400" />
                                <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">
                                  {shuttle.seatsAvailable} seats
                                </span>
                              </div>
                              <div className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${getOccupancyColor(shuttle.occupancyPercent)}`}>
                                {shuttle.occupancyPercent}% full
                              </div>
                              {shuttle.priceRange.daily && (
                                <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                  Rs. {shuttle.priceRange.daily.min}/day
                                </span>
                              )}
                              {shuttle.priceRange.monthly && !shuttle.priceRange.daily && (
                                <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                                  Rs. {shuttle.priceRange.monthly.min}/mo
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0 mt-1" />
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <BusIcon className="w-12 h-12 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No shuttles found</p>
              <p className="text-xs text-muted-foreground mt-1">Try a different search or area</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}
