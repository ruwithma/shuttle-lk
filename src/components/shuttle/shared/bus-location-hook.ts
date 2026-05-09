'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useSharedSocket } from './socket-provider'

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
  interpolatedPosition: { lat: number; lng: number } | null
}

// Interpolation: smoothly move between GPS updates
const INTERPOLATION_INTERVAL = 50 // ms between interpolation frames

export function useBusLocation(busId: string | null | undefined): UseBusLocationReturn {
  const { getSocket, connected } = useSharedSocket()
  const [location, setLocation] = useState<BusLocation | null>(null)
  const [isLive, setIsLive] = useState(false)
  const [trail, setTrail] = useState<TrailPoint[]>([])
  const [interpolatedPosition, setInterpolatedPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [activeBusId, setActiveBusId] = useState<string | null>(null)
  const subscribedRef = useRef<string | null>(null)
  const interpRef = useRef<{
    startLat: number; startLng: number
    endLat: number; endLng: number
    startTime: number; duration: number
  } | null>(null)
  const interpFrameRef = useRef<number>(0)

  // Reset state when busId changes
  const resolvedBusId = busId ?? null
  if (activeBusId !== resolvedBusId) {
    setActiveBusId(resolvedBusId)
    setLocation(null)
    setIsLive(false)
    setTrail([])
    setInterpolatedPosition(null)
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
          const busLoc = {
            lat: loc.lat,
            lng: loc.lng,
            speed: loc.speed,
            heading: loc.heading,
            timestamp: loc.timestamp,
          }
          setLocation(busLoc)
          setInterpolatedPosition({ lat: loc.lat, lng: loc.lng })
          setIsLive(loc.isLive ?? false)
        }
        if (data.trail && data.trail.length > 0) {
          setTrail(data.trail)
        }
      })
      .catch(() => {})

    return () => { cancelled = true }
  }, [activeBusId])

  // Interpolation loop for smooth movement
  useEffect(() => {
    if (!location) return

    const animate = () => {
      const interp = interpRef.current
      if (interp) {
        const now = performance.now()
        const t = Math.min((now - interp.startTime) / interp.duration, 1)
        // Ease-out cubic
        const eased = 1 - Math.pow(1 - t, 3)
        const lat = interp.startLat + (interp.endLat - interp.startLat) * eased
        const lng = interp.startLng + (interp.endLng - interp.startLng) * eased
        setInterpolatedPosition({ lat, lng })
      }
      interpFrameRef.current = requestAnimationFrame(animate)
    }

    interpFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (interpFrameRef.current) {
        cancelAnimationFrame(interpFrameRef.current)
      }
    }
  }, [location])

  // Subscribe/unsubscribe to socket room
  useEffect(() => {
    const socket = getSocket()
    if (!socket || !connected) return

    if (subscribedRef.current && subscribedRef.current !== activeBusId) {
      socket.emit('unsubscribe-bus', { busId: subscribedRef.current })
      subscribedRef.current = null
    }

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
        const newLoc = {
          lat: data.lat,
          lng: data.lng,
          speed: data.speed ?? null,
          heading: data.heading ?? null,
          timestamp: data.timestamp ?? new Date().toISOString(),
        }

        // Set up interpolation from current displayed position to new position
        const currentInterp = interpolatedPosition || location
        if (currentInterp) {
          const dist = Math.sqrt(
            Math.pow(newLoc.lat - currentInterp.lat, 2) +
            Math.pow(newLoc.lng - currentInterp.lng, 2)
          )
          const duration = Math.min(Math.max(800, dist * 500000), 3000)
          interpRef.current = {
            startLat: currentInterp.lat,
            startLng: currentInterp.lng,
            endLat: newLoc.lat,
            endLng: newLoc.lng,
            startTime: performance.now(),
            duration,
          }
        }

        setLocation(newLoc)
        setIsLive(true)

        setTrail((prev) => {
          const newTrail = [
            ...prev,
            { lat: data.lat, lng: data.lng, timestamp: data.timestamp },
          ]
          return newTrail.length > 30 ? newTrail.slice(-30) : newTrail
        })
      }
    }

    socket.on('bus-location', handleLocationUpdate)

    return () => {
      socket.off('bus-location', handleLocationUpdate)
    }
  }, [getSocket, activeBusId, location, interpolatedPosition])

  return { location, isLive, trail, connected, interpolatedPosition }
}

// Hook for tracking multiple buses (owner fleet view)
export function useFleetLocations(ownerId: string | null | undefined) {
  const { getSocket, connected } = useSharedSocket()
  const [locations, setLocations] = useState<Array<{
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
  }>>([])
  const [loading, setLoading] = useState(true)
  const subscribedRef = useRef<string | null>(null)

  // Fetch initial locations
  useEffect(() => {
    if (!ownerId) return
    let cancelled = false

    fetch(`/api/locations?ownerId=${ownerId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        if (data.locations && Array.isArray(data.locations)) {
          setLocations(data.locations)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    return () => { cancelled = true }
  }, [ownerId])

  // Socket subscription
  useEffect(() => {
    const socket = getSocket()
    if (!socket || !connected || !ownerId) return

    const onConnect = () => {
      socket.emit('subscribe-owner', { ownerId })
      subscribedRef.current = ownerId
    }

    if (socket.connected) {
      onConnect()
    }

    socket.on('connect', onConnect)

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

    socket.on('driver-started', (data: { busId: string }) => {
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
      socket.off('connect', onConnect)
      if (subscribedRef.current) {
        socket.emit('unsubscribe-owner', { ownerId: subscribedRef.current })
        subscribedRef.current = null
      }
    }
  }, [getSocket, connected, ownerId])

  return { locations, loading }
}
