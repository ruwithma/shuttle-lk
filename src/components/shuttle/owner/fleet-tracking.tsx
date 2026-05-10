'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bus as BusIcon, MapPin, ChevronLeft, Navigation } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import ShuttleMap from '@/components/shuttle/shared/shuttle-map-wrapper'
import { useFleetLocations } from '@/components/shuttle/shared/bus-location-hook'
import { formatDistanceToNow } from 'date-fns'

const BUS_COLORS = ['#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#3b82f6', '#ec4899']

export default function FleetTracking() {
  const { currentUser, buses, setBuses } = useAppStore()
  const { locations, loading } = useFleetLocations(currentUser?.id ?? null)
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null)

  // Load buses if not already loaded
  useEffect(() => {
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

  // Parse route paths from bus data
  // Bus.routeCoordinates stores [lat, lng] pairs (seed data convention)
  // Route.coordinates stores [lng, lat] pairs (MapLibre convention)
  // Helper to normalize any coordinate pair to [lat, lng]
  const normalizeToLatLng = (c: [number, number]): [number, number] => {
    // Sri Lanka: lat ~6-10, lng ~79-82
    // If first value is in longitude range (> 50), swap it
    if (c[0] > 50 && c[0] < 180) return [c[1], c[0]]
    return c
  }

  const busRoutePaths = useMemo(() => {
    const paths: Record<string, [number, number][]> = {}
    buses.forEach(bus => {
      try {
        const coords = JSON.parse(bus.routeCoordinates || '[]')
        if (Array.isArray(coords) && coords.length > 1) {
          paths[bus.id] = coords.map((c: [number, number]) => normalizeToLatLng(c))
        }
      } catch {
        // ignore parse errors
      }
    })
    return paths
  }, [buses])

  // Stable color assignment based on busId (not array index which changes)
  const getBusColor = useCallback((busId: string) => {
    let hash = 0
    for (let i = 0; i < busId.length; i++) {
      hash = busId.charCodeAt(i) + ((hash << 5) - hash)
    }
    return BUS_COLORS[Math.abs(hash) % BUS_COLORS.length]
  }, [])

  // Fleet buses for map display - include buses with valid coordinates
  const fleetBuses = useMemo(() => {
    if (!locations || locations.length === 0) return []
    return locations
      .filter((loc) => loc.lat !== 0 && loc.lng !== 0) // Only show on map if valid coords
      .map((loc) => ({
        busId: loc.busId,
        busName: loc.busName || 'Unknown Bus',
        plateNumber: loc.plateNumber || '',
        lat: loc.lat,
        lng: loc.lng,
        heading: loc.heading ?? undefined,
        speed: loc.speed ?? undefined,
        isLive: loc.isLive,
        lastUpdate: loc.timestamp
          ? formatDistanceToNow(new Date(loc.timestamp), { addSuffix: true })
          : undefined,
        color: getBusColor(loc.busId),
      }))
  }, [locations, getBusColor])

  // Selected bus route path
  const selectedRoutePath = selectedBusId ? busRoutePaths[selectedBusId] || null : null

  // Selected bus stops (from routeStopCoordinates - stored as object {name: [lat, lng]})
  const selectedBusStops = useMemo(() => {
    if (!selectedBusId) return undefined
    const bus = buses.find(b => b.id === selectedBusId)
    if (!bus) return undefined

    try {
      // Try object format first: { "Stop Name": [lat, lng] }
      const stopCoords = JSON.parse(bus.routeStopCoordinates || '{}')
      if (typeof stopCoords === 'object' && !Array.isArray(stopCoords) && Object.keys(stopCoords).length > 0) {
        return Object.entries(stopCoords).map(([name, coord], idx) => {
          const c = coord as [number, number]
          const normalized = normalizeToLatLng(c)
          return {
            name,
            lat: normalized[0],
            lng: normalized[1],
            estimatedMinutes: undefined,
          }
        })
      }

      // Try array format: [{ name, lat, lng, ... }]
      if (Array.isArray(stopCoords) && stopCoords.length > 0) {
        return stopCoords.map((s: { name?: string; lat: number; lng: number; estimatedMinutes?: number }) => ({
          name: s.name || 'Stop',
          lat: s.lat,
          lng: s.lng,
          estimatedMinutes: s.estimatedMinutes,
        }))
      }
    } catch {
      // ignore
    }
    return undefined
  }, [selectedBusId, buses])

  // Selected bus location (live)
  const selectedBusLocation = useMemo(() => {
    if (!selectedBusId) return undefined
    const loc = locations.find(l => l.busId === selectedBusId)
    if (!loc || (loc.lat === 0 && loc.lng === 0)) return undefined
    return {
      lat: loc.lat,
      lng: loc.lng,
      heading: loc.heading ?? undefined,
      speed: loc.speed ?? undefined,
    }
  }, [selectedBusId, locations])

  // Selected bus info
  const selectedBus = useMemo(() => {
    if (!selectedBusId) return null
    const loc = locations.find(l => l.busId === selectedBusId)
    if (!loc) return null
    const bus = buses.find(b => b.id === selectedBusId)
    return {
      ...loc,
      busName: loc.busName || bus?.name || 'Unknown',
      routeStart: bus?.routeStart,
      routeEnd: bus?.routeEnd,
    }
  }, [selectedBusId, locations, buses])

  // Map center and zoom
  const mapCenter = useMemo((): [number, number] => {
    if (selectedBusId && selectedBusLocation) {
      return [selectedBusLocation.lat, selectedBusLocation.lng]
    }
    // Default: University of Kelaniya area where most routes converge
    return [6.9750, 79.9030]
  }, [selectedBusId, selectedBusLocation])

  const mapZoom = selectedBusId ? 14 : 10

  const liveCount = locations.filter((l) => l.isLive).length

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse w-48" />
        <div className="h-80 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
        <div className="h-20 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="p-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AnimatePresence mode="wait">
            {selectedBusId ? (
              <motion.div
                key="back"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center gap-2"
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedBusId(null)}
                  className="h-8 px-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                >
                  <ChevronLeft className="w-4 h-4 mr-0.5" />
                  All Buses
                </Button>
              </motion.div>
            ) : (
              <motion.h2
                key="title"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="text-lg font-bold text-gray-900 dark:text-gray-100"
              >
                Fleet Tracking
              </motion.h2>
            )}
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={`text-[10px] ${liveCount > 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
            {liveCount}/{locations.length} Live
          </Badge>
        </div>
      </div>

      {/* Map */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="rounded-none border-0 shadow-none dark:bg-gray-900 overflow-hidden">
          <div style={{ height: 400 }}>
            <ShuttleMap
              fleetBuses={selectedBusId ? [] : fleetBuses}
              routePath={selectedRoutePath || undefined}
              busLocation={selectedBusLocation}
              stops={selectedBusStops}
              showLiveBus={!!selectedBusId && !!selectedBusLocation}
              followBus={!!selectedBusId && !!selectedBusLocation}
              center={mapCenter}
              zoom={mapZoom}
              showZoomControl={true}
              className="rounded-none"
            />
          </div>
        </Card>
      </motion.div>

      {/* Selected Bus Detail Card */}
      <AnimatePresence>
        {selectedBusId && selectedBus && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: 'spring', bounce: 0.2 }}
            className="px-4 pt-3"
          >
            <Card className="rounded-2xl border-0 shadow-sm dark:bg-gray-900">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/50 flex items-center justify-center">
                      <BusIcon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    {selectedBus.isLive && (
                      <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-base font-bold text-gray-900 dark:text-gray-100 truncate">{selectedBus.busName}</p>
                      {selectedBus.isLive ? (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-900/50 px-1.5 py-0.5 rounded-full">LIVE</span>
                      ) : (
                        <span className="text-[10px] text-gray-400 font-medium bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full">Offline</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{selectedBus.plateNumber}</p>
                    {selectedBus.routeStart && selectedBus.routeEnd && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {selectedBus.routeStart} → {selectedBus.routeEnd}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    {selectedBus.speed != null && selectedBus.speed > 0 && (
                      <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <Navigation className="w-3 h-3" />
                        <span className="text-sm font-bold">{Math.round(selectedBus.speed)}</span>
                        <span className="text-[10px] font-medium">km/h</span>
                      </div>
                    )}
                    {selectedBus.timestamp && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {selectedBus.isLive ? 'Updated' : 'Last seen'} {formatDistanceToNow(new Date(selectedBus.timestamp), { addSuffix: true })}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bus List */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="p-4"
      >
        <Card className="rounded-2xl border-0 shadow-sm dark:bg-gray-900">
          <div className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {selectedBusId ? 'Other Buses' : 'All Buses'}
            </h3>
            {locations.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                {locations
                  .filter(loc => !selectedBusId || loc.busId !== selectedBusId)
                  .map((loc) => {
                  const busColor = getBusColor(loc.busId)
                  const isSelected = selectedBusId === loc.busId
                  return (
                    <div
                      key={loc.busId}
                      className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all ${
                        isSelected
                          ? 'ring-2 ring-emerald-500 bg-emerald-50 dark:bg-emerald-900/30'
                          : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750'
                      }`}
                      onClick={() => setSelectedBusId(isSelected ? null : loc.busId)}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: `${busColor}15` }}
                      >
                        <BusIcon className="w-5 h-5" style={{ color: busColor }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{loc.busName || 'Unknown'}</p>
                          {loc.isLive ? (
                            <div className="flex items-center gap-1">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                              </span>
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Live</span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">Offline</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{loc.plateNumber || 'N/A'} &middot; {loc.routeName || 'N/A'}</p>
                        {loc.timestamp && (
                          <p className="text-[10px] text-muted-foreground">
                            {loc.isLive ? 'Updated' : 'Last seen'} {formatDistanceToNow(new Date(loc.timestamp), { addSuffix: true })}
                          </p>
                        )}
                      </div>
                      <MapPin className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
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
