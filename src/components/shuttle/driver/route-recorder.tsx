'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Circle, Square, MapPin, Plus, Check, X, Trash2,
  RotateCcw, Save, Bus as BusIcon, Clock, Route, Waypoints
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { useSharedSocket } from '@/components/shuttle/shared/socket-provider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import ShuttleMap from '@/components/shuttle/shared/shuttle-map-wrapper'
import { toast } from '@/hooks/use-toast'

interface RecordedStop {
  name: string
  lat: number
  lng: number
  order: number
  estimatedMinutes: number
}

export default function RouteRecorder() {
  const { currentUser, driverDashboard } = useAppStore()
  const { socket, connected } = useSharedSocket()

  const [isRecording, setIsRecording] = useState(false)
  const [recordedCoords, setRecordedCoords] = useState<[number, number][]>([]) // [lat, lng]
  const [recordedStops, setRecordedStops] = useState<RecordedStop[]>([])
  const [recordStartTime, setRecordStartTime] = useState<number | null>(null)
  const [routeName, setRouteName] = useState('')
  const [routeDirection, setRouteDirection] = useState<'forward' | 'return'>('forward')
  const [showStopInput, setShowStopInput] = useState(false)
  const [newStopName, setNewStopName] = useState('')
  const [saving, setSaving] = useState(false)
  const [snappingToRoad, setSnappingToRoad] = useState(false)
  const [existingRoutes, setExistingRoutes] = useState<any[]>([])
  const [loadingRoutes, setLoadingRoutes] = useState(true)

  const watchIdRef = useRef<number | null>(null)
  const coordIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastCoordRef = useRef<[number, number] | null>(null)

  const bus = driverDashboard?.bus

  // Load existing routes for this bus
  useEffect(() => {
    if (!bus?.id) return
    fetch(`/api/routes?busId=${bus.id}`)
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        setExistingRoutes(Array.isArray(data) ? data : data.routes || [])
      })
      .catch(() => {})
      .finally(() => setLoadingRoutes(false))
  }, [bus?.id])

  const startRecording = useCallback(() => {
    if (!bus?.id) {
      toast({ title: 'No bus assigned', description: 'You need a bus to record a route', variant: 'destructive' })
      return
    }

    setIsRecording(true)
    setRecordedCoords([])
    setRecordedStops([])
    setRecordStartTime(Date.now())

    // Start watching GPS position
    if ('geolocation' in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude
          const lng = pos.coords.longitude
          const newCoord: [number, number] = [lat, lng]

          // Only add if moved at least 10 meters from last point
          if (lastCoordRef.current) {
            const dist = Math.sqrt(
              Math.pow(lat - lastCoordRef.current[0], 2) +
              Math.pow(lng - lastCoordRef.current[1], 2)
            )
            if (dist < 0.0001) return // ~11m threshold
          }

          setRecordedCoords(prev => [...prev, newCoord])
          lastCoordRef.current = newCoord

          // Send location via WebSocket
          if (socket?.connected) {
            socket.emit('driver-location', {
              busId: bus.id,
              lat,
              lng,
              speed: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : null,
              heading: pos.coords.heading ? Math.round(pos.coords.heading) : null,
            })
          }
        },
        (err) => {
          console.warn('GPS error:', err.message)
          toast({ title: 'GPS Error', description: 'Using simulation mode for recording', variant: 'destructive' })
          // Fallback: simulate along existing route coords
          startSimulationFallback()
        },
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
      )
    } else {
      startSimulationFallback()
    }
  }, [bus, socket])

  const startSimulationFallback = useCallback(() => {
    // Simulate along existing route coordinates
    try {
      const coords = JSON.parse(bus?.routeCoordinates || '[]')
      if (!Array.isArray(coords) || coords.length < 2) return

      let idx = 0
      coordIntervalRef.current = setInterval(() => {
        const [lat, lng] = coords[idx]
        setRecordedCoords(prev => [...prev, [lat, lng]])
        lastCoordRef.current = [lat, lng]
        idx = (idx + 1) % coords.length
      }, 2000)
    } catch {}
  }, [bus?.routeCoordinates])

  const stopRecording = useCallback(() => {
    setIsRecording(false)

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (coordIntervalRef.current) {
      clearInterval(coordIntervalRef.current)
      coordIntervalRef.current = null
    }
    lastCoordRef.current = null

    toast({ title: 'Route Recorded', description: `Captured ${recordedCoords.length} points and ${recordedStops.length} stops` })
  }, [recordedCoords.length, recordedStops.length])

  const addStop = useCallback(() => {
    if (!newStopName.trim() || !recordedCoords.length) return

    // Use the last recorded coordinate as the stop position
    const lastCoord = recordedCoords[recordedCoords.length - 1]
    const elapsedMs = recordStartTime ? Date.now() - recordStartTime : 0
    const elapsedMinutes = Math.round(elapsedMs / 60000)

    setRecordedStops(prev => [...prev, {
      name: newStopName.trim(),
      lat: lastCoord[0],
      lng: lastCoord[1],
      order: prev.length + 1,
      estimatedMinutes: elapsedMinutes,
    }])

    setNewStopName('')
    setShowStopInput(false)
    toast({ title: 'Stop Added', description: `${newStopName.trim()} marked at current location` })
  }, [newStopName, recordedCoords, recordStartTime])

  const clearRecording = useCallback(() => {
    setIsRecording(false)
    setRecordedCoords([])
    setRecordedStops([])
    setRecordStartTime(null)
    setRouteName('')
    setRouteDirection('forward')
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (coordIntervalRef.current) {
      clearInterval(coordIntervalRef.current)
      coordIntervalRef.current = null
    }
  }, [])

  const saveRoute = useCallback(async () => {
    if (!bus?.id) return
    if (recordedCoords.length < 5) {
      toast({ title: 'Too few points', description: 'Drive a bit more to record a proper route', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      const name = routeName || `${bus.routeName || 'Route'} - ${routeDirection === 'forward' ? 'Forward' : 'Return'}`

      // Calculate total distance using Haversine
      let totalDist = 0
      for (let i = 1; i < recordedCoords.length; i++) {
        const [lat1, lng1] = recordedCoords[i - 1]
        const [lat2, lng2] = recordedCoords[i]
        const R = 6371000
        const dLat = (lat2 - lat1) * Math.PI / 180
        const dLng = (lng2 - lng1) * Math.PI / 180
        const a = Math.sin(dLat / 2) ** 2 +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLng / 2) ** 2
        totalDist += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      }

      const estimatedDuration = recordStartTime
        ? Math.round((Date.now() - recordStartTime) / 60000)
        : Math.round(totalDist / 1000 / 25 * 60) // Assume 25km/h avg

      const res = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          busId: bus.id,
          name,
          direction: routeDirection,
          coordinates: recordedCoords.map(([lat, lng]) => [lng, lat]), // MapLibre [lng, lat] order
          stops: recordedStops,
          totalDistance: totalDist,
          estimatedDuration,
        }),
      })

      if (res.ok) {
        toast({ title: 'Route Saved!', description: `"${name}" has been saved successfully` })
        clearRecording()
        // Reload routes
        const routesRes = await fetch(`/api/routes?busId=${bus.id}`)
        if (routesRes.ok) {
          const data = await routesRes.json()
          setExistingRoutes(Array.isArray(data) ? data : data.routes || [])
        }
      } else {
        const data = await res.json()
        toast({ title: 'Error', description: data.error || 'Failed to save route', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Network error while saving', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }, [bus, recordedCoords, recordedStops, routeName, routeDirection, recordStartTime, clearRecording])

  const snapToRoads = useCallback(async () => {
    if (recordedCoords.length < 2) return
    setSnappingToRoad(true)
    try {
      // Simplify waypoints to ~10 key points for OSRM
      const step = Math.max(1, Math.floor(recordedCoords.length / 10))
      const keyWaypoints: [number, number][] = []
      for (let i = 0; i < recordedCoords.length; i += step) {
        keyWaypoints.push(recordedCoords[i])
      }
      // Always include last point
      const lastCoord = recordedCoords[recordedCoords.length - 1]
      if (keyWaypoints[keyWaypoints.length - 1][0] !== lastCoord[0] || keyWaypoints[keyWaypoints.length - 1][1] !== lastCoord[1]) {
        keyWaypoints.push(lastCoord)
      }

      const res = await fetch('/api/routing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waypoints: keyWaypoints }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.coordinates && data.coordinates.length > 1) {
          // API returns [lng, lat] but we store [lat, lng]
          const snappedCoords: [number, number][] = data.coordinates.map(
            (c: [number, number]) => {
              // If first value > 90, it's longitude
              if (c[0] > 90) return [c[1], c[0]] as [number, number]
              return [c[0], c[1]] as [number, number]
            }
          )
          setRecordedCoords(snappedCoords)
          toast({ title: 'Route Snapped!', description: `${snappedCoords.length} road-following points` })
        }
      } else {
        toast({ title: 'Snap Failed', description: 'Could not snap to roads', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Snap Failed', description: 'Could not snap to roads', variant: 'destructive' })
    } finally {
      setSnappingToRoad(false)
    }
  }, [recordedCoords])

  const deleteRoute = useCallback(async (routeId: string) => {
    try {
      const res = await fetch(`/api/routes?routeId=${routeId}`, { method: 'DELETE' })
      if (res.ok) {
        setExistingRoutes(prev => prev.filter((r: any) => r.id !== routeId))
        toast({ title: 'Route Deleted' })
      }
    } catch {}
  }, [])

  // Map stops from recorded data
  const mapStops = useMemo(() => {
    return recordedStops.map(s => ({
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      estimatedMinutes: s.estimatedMinutes,
    }))
  }, [recordedStops])

  // Last known position for map center
  const lastPosition = useMemo(() => {
    if (recordedCoords.length > 0) {
      const last = recordedCoords[recordedCoords.length - 1]
      return { lat: last[0], lng: last[1] }
    }
    return undefined
  }, [recordedCoords])

  return (
    <div className="p-4 space-y-4">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Route Recorder</h2>
        <p className="text-sm text-muted-foreground">Record your route once, it shows on the map forever</p>
      </motion.div>

      {/* Recording Controls */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card className={`rounded-2xl border-0 shadow-sm ${isRecording ? 'bg-red-50 dark:bg-red-950/30' : 'bg-gray-50 dark:bg-gray-800'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                {isRecording ? (
                  <div className="relative flex items-center justify-center">
                    <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center">
                      <Circle className="w-5 h-5 text-white fill-white" />
                    </div>
                    <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  </div>
                ) : (
                  <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
                    <Route className="w-5 h-5 text-white" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {isRecording ? 'Recording...' : 'Record Route'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isRecording
                      ? `${recordedCoords.length} points · ${recordedStops.length} stops`
                      : 'Drive your route once to save it'}
                  </p>
                </div>
              </div>
              {!isRecording ? (
                <Button
                  onClick={startRecording}
                  className="rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Circle className="w-4 h-4 mr-1.5 fill-white" />
                  Start
                </Button>
              ) : (
                <Button
                  onClick={stopRecording}
                  className="rounded-xl text-sm font-semibold bg-red-500 hover:bg-red-600 text-white"
                >
                  <Square className="w-4 h-4 mr-1.5 fill-white" />
                  Stop
                </Button>
              )}
            </div>

            {/* Add Stop button while recording */}
            {isRecording && (
              <div className="flex gap-2 mt-2">
                <Button
                  onClick={() => setShowStopInput(!showStopInput)}
                  variant="outline"
                  size="sm"
                  className="rounded-xl text-xs flex-1"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Stop Here
                </Button>
                <Button
                  onClick={clearRecording}
                  variant="outline"
                  size="sm"
                  className="rounded-xl text-xs text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}

            {/* Stop name input */}
            <AnimatePresence>
              {showStopInput && isRecording && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden mt-2"
                >
                  <div className="flex gap-2">
                    <Input
                      placeholder="Stop name (e.g. Kandy Station)"
                      value={newStopName}
                      onChange={(e) => setNewStopName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addStop()}
                      className="h-9 text-sm rounded-xl"
                      autoFocus
                    />
                    <Button onClick={addStop} size="sm" className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3">
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button onClick={() => { setShowStopInput(false); setNewStopName('') }} size="sm" variant="outline" className="rounded-xl px-3">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>

      {/* Live Map While Recording */}
      {(isRecording || recordedCoords.length > 0) && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div style={{ height: 300 }}>
                <ShuttleMap
                  routePath={recordedCoords}
                  stops={mapStops}
                  busLocation={lastPosition}
                  showLiveBus={isRecording}
                  followBus={isRecording}
                  center={recordedCoords.length > 0 ? recordedCoords[0] : [7.8731, 80.7718]}
                  zoom={13}
                  className="rounded-none"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Recorded Stops List */}
      {recordedStops.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Recorded Stops</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="space-y-2">
                {recordedStops.map((stop, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-2 rounded-xl bg-gray-50 dark:bg-gray-800">
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full ${idx === 0 ? 'bg-emerald-500' : idx === recordedStops.length - 1 ? 'bg-red-500' : 'bg-gray-400'}`} />
                      {idx < recordedStops.length - 1 && <div className="w-0.5 h-4 bg-gray-300 dark:bg-gray-600 mt-1" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{stop.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {stop.estimatedMinutes > 0 ? `${stop.estimatedMinutes} min from start` : 'Starting point'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 rounded-full text-red-400 hover:bg-red-50"
                      onClick={() => setRecordedStops(prev => prev.filter((_, i) => i !== idx))}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Save Route Section */}
      {!isRecording && recordedCoords.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-900 dark:text-gray-100">Save Route</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 space-y-3">
              {/* Snap to Roads Button */}
              <Button
                onClick={snapToRoads}
                disabled={snappingToRoad || recordedCoords.length < 2}
                variant="outline"
                className="w-full h-10 rounded-xl text-sm font-medium border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
              >
                {snappingToRoad ? (
                  <>
                    <Route className="w-4 h-4 mr-2 animate-spin" />
                    Snapping to Roads...
                  </>
                ) : (
                  <>
                    <Waypoints className="w-4 h-4 mr-2" />
                    Snap to Roads
                  </>
                )}
              </Button>
              <Input
                placeholder="Route name (e.g. Kandy - Colombo Express)"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                className="rounded-xl h-10"
              />
              <div className="flex gap-2">
                <Button
                  variant={routeDirection === 'forward' ? 'default' : 'outline'}
                  onClick={() => setRouteDirection('forward')}
                  className={`flex-1 rounded-xl text-xs ${routeDirection === 'forward' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                >
                  Forward
                </Button>
                <Button
                  variant={routeDirection === 'return' ? 'default' : 'outline'}
                  onClick={() => setRouteDirection('return')}
                  className={`flex-1 rounded-xl text-xs ${routeDirection === 'return' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                >
                  Return
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
                  <p className="text-muted-foreground">Points</p>
                  <p className="font-bold text-gray-900 dark:text-gray-100">{recordedCoords.length}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
                  <p className="text-muted-foreground">Stops</p>
                  <p className="font-bold text-gray-900 dark:text-gray-100">{recordedStops.length}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={saveRoute}
                  disabled={saving}
                  className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  {saving ? 'Saving...' : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Route
                    </>
                  )}
                </Button>
                <Button
                  onClick={clearRecording}
                  variant="outline"
                  className="rounded-xl text-red-600 hover:bg-red-50"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Existing Routes */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Saved Routes</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            {loadingRoutes ? (
              <div className="space-y-2">
                {[1, 2].map(i => (
                  <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : existingRoutes.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {existingRoutes.map((route: any) => (
                  <div key={route.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
                    <div className="w-9 h-9 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg flex items-center justify-center">
                      <Route className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{route.name}</p>
                        <Badge className="text-[9px] px-1.5 py-0 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                          {route.direction}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {route.estimatedDuration ? `${route.estimatedDuration} min` : ''}
                        {route.totalDistance ? ` · ${(route.totalDistance / 1000).toFixed(1)} km` : ''}
                        {' · '}{new Date(route.recordedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 rounded-full text-red-400 hover:bg-red-50"
                      onClick={() => deleteRoute(route.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <Route className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No routes recorded yet</p>
                <p className="text-xs text-muted-foreground mt-1">Record your first route above</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
