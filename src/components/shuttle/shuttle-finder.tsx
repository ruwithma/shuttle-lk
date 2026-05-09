'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, MapPin, Users, Bus as BusIcon, Clock, ChevronRight,
  Navigation, Sparkles, X, Wifi, WifiOff, ArrowRight, Star
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import BusMap from '@/components/shuttle/shared/bus-map'
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

export default function ShuttleFinder() {
  const { currentUser } = useAppStore()
  const [query, setQuery] = useState('')
  const [shuttles, setShuttles] = useState<ShuttleResult[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedShuttle, setSelectedShuttle] = useState<ShuttleResult | null>(null)
  const [popularAreas, setPopularAreas] = useState<string[]>([])
  const [usingLocation, setUsingLocation] = useState(false)

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

  // Search handler
  const handleSearch = useCallback(() => {
    if (query.trim()) {
      fetchShuttles(query.trim())
    } else {
      fetchShuttles()
    }
  }, [query, fetchShuttles])

  // Use current location
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

  // Parse route for selected shuttle
  const selectedRoutePath = useMemo<[number, number][]>(() => {
    if (!selectedShuttle) return []
    try {
      const coords = JSON.parse(selectedShuttle.routeCoordinates || '[]')
      if (Array.isArray(coords)) return coords
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
          return { name, lat: c[0], lng: c[1] }
        })
      }
    } catch {}
    return []
  }, [selectedShuttle])

  const liveBuses = useMemo(() => {
    if (!selectedShuttle || !selectedShuttle.currentLat || !selectedShuttle.currentLng) return []
    return [{
      busId: selectedShuttle.id,
      busName: selectedShuttle.name,
      plateNumber: selectedShuttle.plateNumber,
      lat: selectedShuttle.currentLat,
      lng: selectedShuttle.currentLng,
      isLive: selectedShuttle.isLive,
      color: '#10b981',
    }]
  }, [selectedShuttle])

  // Occupancy color
  const getOccupancyColor = (pct: number) => {
    if (pct >= 90) return 'text-red-600 bg-red-50'
    if (pct >= 70) return 'text-amber-600 bg-amber-50'
    return 'text-emerald-600 bg-emerald-50'
  }

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="h-12 bg-gray-100 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map(i => <div key={i} className="h-8 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
        {[1, 2, 3].map(i => <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />)}
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-xl font-bold text-gray-900">Find Shuttles</h2>
        <p className="text-sm text-muted-foreground">Discover shuttle routes near you</p>
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
              className="pl-10 h-11 rounded-xl bg-white border-gray-200"
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
            <Navigation className="w-4 h-4" />
          </Button>
        </div>
      </motion.div>

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
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:border-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
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
            <Card className="rounded-2xl border-0 shadow-sm overflow-hidden mb-4">
              <div style={{ height: 280 }}>
                <BusMap
                  routePath={selectedRoutePath}
                  stops={selectedStops}
                  fleetBuses={liveBuses}
                  showLiveBus={false}
                  center={selectedRoutePath.length > 0 ? selectedRoutePath[0] : [7.0, 79.9]}
                  zoom={12}
                  className="rounded-none"
                />
              </div>
            </Card>

            {/* Shuttle Detail Card */}
            <Card className="rounded-2xl border-0 shadow-sm mb-4">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
                      <BusIcon className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{selectedShuttle.name}</h3>
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
                <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                    <div className="w-0.5 h-8 bg-gray-300" />
                    <div className="w-2.5 h-2.5 bg-red-500 rounded-full" />
                  </div>
                  <div className="flex flex-col gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">From</p>
                      <p className="text-sm font-semibold">{selectedShuttle.routeStart}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">To</p>
                      <p className="text-sm font-semibold">{selectedShuttle.routeEnd}</p>
                    </div>
                  </div>
                </div>

                {/* Stops */}
                {selectedShuttle.stops.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Route Stops</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedShuttle.stops.map((stop, i) => (
                        <span key={i} className="px-2 py-1 bg-gray-100 rounded-md text-xs font-medium text-gray-600">
                          {stop}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                    <Users className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
                    <p className="text-sm font-bold text-gray-900">{selectedShuttle.seatsAvailable}</p>
                    <p className="text-[10px] text-muted-foreground">Seats Left</p>
                  </div>
                  <div className={`rounded-xl p-2.5 text-center ${getOccupancyColor(selectedShuttle.occupancyPercent)}`}>
                    <BusIcon className="w-4 h-4 mx-auto mb-1" />
                    <p className="text-sm font-bold">{selectedShuttle.occupancyPercent}%</p>
                    <p className="text-[10px]">Full</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                    {selectedShuttle.isLive ? (
                      <>
                        <Wifi className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                        <p className="text-sm font-bold text-emerald-600">Live</p>
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                        <p className="text-sm font-bold text-gray-500">Offline</p>
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
                        <div className="flex-1 bg-amber-50 rounded-xl p-3 text-center">
                          <p className="text-[10px] text-amber-600 font-semibold uppercase">Daily</p>
                          <p className="text-sm font-bold text-amber-800">
                            Rs. {selectedShuttle.priceRange.daily.min}
                            {selectedShuttle.priceRange.daily.min !== selectedShuttle.priceRange.daily.max &&
                              ` - ${selectedShuttle.priceRange.daily.max}`}
                          </p>
                        </div>
                      )}
                      {selectedShuttle.priceRange.monthly && (
                        <div className="flex-1 bg-emerald-50 rounded-xl p-3 text-center">
                          <p className="text-[10px] text-emerald-600 font-semibold uppercase">Monthly</p>
                          <p className="text-sm font-bold text-emerald-800">
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
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-9 h-9 bg-amber-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold text-amber-700">
                        {selectedShuttle.driver.name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{selectedShuttle.driver.name}</p>
                      <p className="text-xs text-muted-foreground">{selectedShuttle.driver.phone}</p>
                    </div>
                  </div>
                )}

                {/* Contact / Subscribe Button */}
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
              {shuttles.map((shuttle, index) => (
                <motion.div
                  key={shuttle.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card
                    className="rounded-2xl border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setSelectedShuttle(shuttle)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-11 h-11 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                          <BusIcon className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900 text-sm truncate">{shuttle.name}</h3>
                            {shuttle.isLive && (
                              <Badge className="text-[9px] px-1.5 py-0 bg-emerald-100 text-emerald-700 flex items-center gap-1">
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
                              <span className="text-[10px] font-medium text-gray-500">
                                {shuttle.seatsAvailable} seats
                              </span>
                            </div>
                            <div className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${getOccupancyColor(shuttle.occupancyPercent)}`}>
                              {shuttle.occupancyPercent}% full
                            </div>
                            {shuttle.priceRange.daily && (
                              <span className="text-[10px] font-medium text-amber-600">
                                Rs. {shuttle.priceRange.daily.min}/day
                              </span>
                            )}
                            {shuttle.priceRange.monthly && !shuttle.priceRange.daily && (
                              <span className="text-[10px] font-medium text-emerald-600">
                                Rs. {shuttle.priceRange.monthly.min}/mo
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 mt-1" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <BusIcon className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No shuttles found</p>
              <p className="text-xs text-muted-foreground mt-1">Try a different search or area</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}
