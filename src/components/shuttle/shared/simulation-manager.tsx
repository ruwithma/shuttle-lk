'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useSharedSocket } from './socket-provider'

interface SimulationPosition {
  lat: number
  lng: number
  speed: number
  heading: number
}

interface UseSimulationReturn {
  startSimulation: () => void
  stopSimulation: () => void
  isSimulating: boolean
  currentPosition: SimulationPosition | null
}

/**
 * useSimulation - Manages simulated bus movement along a route.
 *
 * When started, it moves a virtual bus along the route coordinates
 * using setInterval (every 2 seconds). It sends `driver-location`
 * events via WebSocket and also saves to /api/locations.
 *
 * The route loops: forward then backward (ping-pong).
 */
export function useSimulation(
  busId: string | null | undefined,
  routeCoordinates: [number, number][], // [lat, lng] pairs
  driverId?: string,
  driverName?: string,
  busName?: string,
  ownerId?: string,
  routeName?: string,
  routeStart?: string,
  routeEnd?: string,
  plateNumber?: string,
): UseSimulationReturn {
  const { socket, connected } = useSharedSocket()
  const [isSimulating, setIsSimulating] = useState(false)
  const [currentPosition, setCurrentPosition] = useState<SimulationPosition | null>(null)

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const indexRef = useRef(0)
  const directionRef = useRef<1 | -1>(1) // 1 = forward, -1 = backward
  const prevLatRef = useRef<number | null>(null)
  const prevLngRef = useRef<number | null>(null)

  const startSimulation = useCallback(() => {
    if (!busId || routeCoordinates.length < 2) return

    // Emit driver-start so subscribers know the bus is live
    if (socket?.connected && ownerId) {
      socket.emit('driver-start', {
        busId,
        ownerId,
        driverName: driverName || 'Demo Driver',
        busName: busName || 'Demo Bus',
        routeName: routeName || '',
        routeStart: routeStart || '',
        routeEnd: routeEnd || '',
        plateNumber: plateNumber || '',
      })
    }

    // Reset state
    indexRef.current = 0
    directionRef.current = 1
    prevLatRef.current = null
    prevLngRef.current = null

    // Set initial position
    const startCoord = routeCoordinates[0]
    const initialPos: SimulationPosition = {
      lat: startCoord[0],
      lng: startCoord[1],
      speed: 0,
      heading: 0,
    }
    setCurrentPosition(initialPos)
    setIsSimulating(true)

    // Start interval for continuous updates
    intervalRef.current = setInterval(() => {
      const coords = routeCoordinates
      const currentIdx = indexRef.current
      const direction = directionRef.current

      // Calculate next index
      let nextIdx = currentIdx + direction

      // Ping-pong: reverse direction at ends
      if (nextIdx >= coords.length) {
        directionRef.current = -1
        nextIdx = coords.length - 2
      } else if (nextIdx < 0) {
        directionRef.current = 1
        nextIdx = 1
      }

      indexRef.current = nextIdx

      const currentCoord = coords[currentIdx]
      const nextCoord = coords[nextIdx]

      // Interpolate slightly between current and next for smoother movement
      const frac = 0.5
      const lat = currentCoord[0] + (nextCoord[0] - currentCoord[0]) * frac
      const lng = currentCoord[1] + (nextCoord[1] - currentCoord[1]) * frac

      // Calculate heading based on movement direction
      const dLat = nextCoord[0] - currentCoord[0]
      const dLng = nextCoord[1] - currentCoord[1]
      const heading = Math.round((Math.atan2(dLng, dLat) * 180) / Math.PI)

      // Calculate simulated speed (20-60 km/h range, with some variation)
      const simSpeed = Math.round(25 + Math.random() * 30)

      const pos: SimulationPosition = {
        lat,
        lng,
        speed: simSpeed,
        heading,
      }

      setCurrentPosition(pos)
      prevLatRef.current = lat
      prevLngRef.current = lng

      // Send via WebSocket
      if (socket?.connected) {
        socket.emit('driver-location', {
          busId,
          lat,
          lng,
          speed: simSpeed,
          heading,
        })
      }

      // Save to /api/locations
      fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          busId,
          lat,
          lng,
          speed: simSpeed,
          heading,
          driverId: driverId || undefined,
        }),
      }).catch(() => {})
    }, 2000)
  }, [busId, routeCoordinates, socket, connected, driverId, driverName, busName, ownerId, routeName, routeStart, routeEnd, plateNumber])

  const stopSimulation = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    // Emit driver-stop so subscribers know the bus is offline
    if (socket?.connected && busId && ownerId) {
      socket.emit('driver-stop', {
        busId,
        ownerId,
      })
    }

    setIsSimulating(false)
    setCurrentPosition(null)
    indexRef.current = 0
    directionRef.current = 1
    prevLatRef.current = null
    prevLngRef.current = null
  }, [socket, busId, ownerId])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  // Stop simulation if socket disconnects
  useEffect(() => {
    if (!connected && isSimulating) {
      // Don't stop simulation entirely, just note the disconnect
      // The simulation will continue trying to send when reconnected
    }
  }, [connected, isSimulating])

  return {
    startSimulation,
    stopSimulation,
    isSimulating,
    currentPosition,
  }
}
