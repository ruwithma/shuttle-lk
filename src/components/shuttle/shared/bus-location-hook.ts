'use client'

import { useEffect, useState, useRef } from 'react'
import { useSocket } from './use-socket'

interface BusLocation {
  lat: number
  lng: number
  speed?: number | null
  heading?: number | null
  timestamp?: string | null
}

interface TrailPoint {
  lat: number
  lng: number
  timestamp?: string
}

interface UseBusLocationReturn {
  location: BusLocation | null
  isLive: boolean
  trail: TrailPoint[]
  connected: boolean
}

export function useBusLocation(busId: string | null | undefined): UseBusLocationReturn {
  const { getSocket, connected } = useSocket()
  const [location, setLocation] = useState<BusLocation | null>(null)
  const [isLive, setIsLive] = useState(false)
  const [trail, setTrail] = useState<TrailPoint[]>([])
  const [activeBusId, setActiveBusId] = useState<string | null>(null)
  const subscribedRef = useRef<string | null>(null)

  // Reset state when busId changes (using the "adjust state during render" pattern)
  const resolvedBusId = busId ?? null
  if (activeBusId !== resolvedBusId) {
    setActiveBusId(resolvedBusId)
    setLocation(null)
    setIsLive(false)
    setTrail([])
  }

  // Fetch initial data when activeBusId changes
  useEffect(() => {
    if (!activeBusId) return
    let cancelled = false

    fetch(`/api/locations?busId=${activeBusId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        if (data.locations && data.locations.length > 0) {
          const loc = data.locations[0]
          setLocation({
            lat: loc.lat,
            lng: loc.lng,
            speed: loc.speed,
            heading: loc.heading,
            timestamp: loc.timestamp,
          })
          setIsLive(loc.isLive ?? false)
        }
        if (data.trail && data.trail.length > 0) {
          setTrail(data.trail)
        }
      })
      .catch(() => {
        // silently fail
      })

    return () => {
      cancelled = true
    }
  }, [activeBusId])

  // Subscribe/unsubscribe to socket room when busId or socket changes
  useEffect(() => {
    const socket = getSocket()
    if (!socket || !connected) return

    // Unsubscribe from previous bus
    if (subscribedRef.current && subscribedRef.current !== activeBusId) {
      socket.emit('unsubscribe-bus', { busId: subscribedRef.current })
      subscribedRef.current = null
    }

    // Subscribe to new bus
    if (activeBusId) {
      socket.emit('subscribe-bus', { busId: activeBusId })
      subscribedRef.current = activeBusId
    }

    return () => {
      if (subscribedRef.current) {
        socket.emit('unsubscribe-bus', { busId: subscribedRef.current })
        subscribedRef.current = null
      }
    }
  }, [getSocket, connected, activeBusId])

  // Listen for location updates
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const handleLocationUpdate = (data: {
      busId: string
      lat: number
      lng: number
      speed?: number
      heading?: number
      timestamp?: string
    }) => {
      if (data.busId === activeBusId) {
        setLocation({
          lat: data.lat,
          lng: data.lng,
          speed: data.speed ?? null,
          heading: data.heading ?? null,
          timestamp: data.timestamp ?? new Date().toISOString(),
        })
        setIsLive(true)

        // Append to trail
        setTrail((prev) => {
          const newTrail = [
            ...prev,
            { lat: data.lat, lng: data.lng, timestamp: data.timestamp },
          ]
          // Keep only the last 20 points
          return newTrail.length > 20 ? newTrail.slice(-20) : newTrail
        })
      }
    }

    socket.on('bus-location', handleLocationUpdate)

    return () => {
      socket.off('bus-location', handleLocationUpdate)
    }
  }, [getSocket, activeBusId])

  return { location, isLive, trail, connected }
}
