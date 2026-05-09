'use client'

import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import AnimatedMarker from './animated-marker'

// Inject Leaflet CSS
let leafletCssInjected = false
function injectLeafletCss() {
  if (leafletCssInjected) return
  if (typeof document === 'undefined') return
  const existing = document.querySelector('link[href*="leaflet"]')
  if (existing) { leafletCssInjected = true; return }
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
  link.crossOrigin = ''
  document.head.appendChild(link)
  leafletCssInjected = true
}

interface FleetBus {
  busId: string
  busName: string
  plateNumber: string
  lat: number
  lng: number
  heading?: number
  speed?: number
  isLive: boolean
  driverName?: string
  lastUpdate?: string
  color?: string
}

interface BusMapProps {
  center?: [number, number]
  zoom?: number
  routePath?: [number, number][]
  busLocation?: { lat: number; lng: number; heading?: number; speed?: number }
  stops?: { name: string; lat: number; lng: number }[]
  trail?: { lat: number; lng: number }[]
  showLiveBus?: boolean
  className?: string
  onMapClick?: (lat: number, lng: number) => void
  fleetBuses?: FleetBus[]
  interpolatedPosition?: { lat: number; lng: number } | null
  studentStop?: { name: string; lat: number; lng: number } | null
  eta?: string | null
}

const DEFAULT_CENTER: [number, number] = [7.8731, 80.7718]
const DEFAULT_ZOOM = 8

// Component to auto-fit map bounds
function MapBoundsFitter({
  routePath,
  stops,
  busLocation,
  fleetBuses,
  initialFit,
}: {
  routePath?: [number, number][]
  stops?: { name: string; lat: number; lng: number }[]
  busLocation?: { lat: number; lng: number }
  fleetBuses?: FleetBus[]
  initialFit?: boolean
}) {
  const map = useMap()

  const bounds = useMemo(() => {
    const points: L.LatLngTuple[] = []
    if (routePath && routePath.length > 0) points.push(...routePath)
    if (stops && stops.length > 0) stops.forEach((s) => points.push([s.lat, s.lng]))
    if (busLocation) points.push([busLocation.lat, busLocation.lng])
    if (fleetBuses && fleetBuses.length > 0) fleetBuses.forEach((fb) => points.push([fb.lat, fb.lng]))
    return points
  }, [routePath, stops, busLocation, fleetBuses])

  // Only fit bounds on initial data load, not on every location update
  useEffect(() => {
    if (initialFit && bounds.length > 0) {
      const latLngBounds = L.latLngBounds(bounds)
      map.fitBounds(latLngBounds, { padding: [40, 40], maxZoom: 15 })
    }
  }, [initialFit, bounds, map])

  return null
}

// Click handler
function MapClickHandler({ onMapClick }: { onMapClick?: (lat: number, lng: number) => void }) {
  const map = useMap()
  useEffect(() => {
    if (!onMapClick) return
    const handleClick = (e: L.LeafletMouseEvent) => { onMapClick(e.latlng.lat, e.latlng.lng) }
    map.on('click', handleClick)
    return () => { map.off('click', handleClick) }
  }, [map, onMapClick])
  return null
}

// Student stop marker with ETA badge
function StudentStopMarker({ stop, eta }: { stop: { name: string; lat: number; lng: number }; eta?: string | null }) {
  const icon = useMemo(() => {
    const etaHtml = eta ? `<div style="background:#1f2937;color:white;font-size:8px;font-weight:700;padding:1px 5px;border-radius:4px;white-space:nowrap;margin-top:2px;font-family:system-ui;">ETA ${eta}</div>` : ''
    const html = `
      <div style="display:flex;flex-direction:column;align-items:center;">
        <div style="width:14px;height:14px;background:#3b82f6;border:2.5px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(59,130,246,0.5);"></div>
        ${etaHtml}
      </div>
    `
    return L.divIcon({ html, className: '', iconSize: [14, 14], iconAnchor: [7, 7] })
  }, [eta])

  return (
    <Marker
      position={[stop.lat, stop.lng]}
      icon={icon}
      zIndexOffset={900}
    >
      <Tooltip direction="top" offset={[0, -10]} permanent={false}>
        <span className="text-xs font-semibold text-blue-700">{stop.name} {eta ? `(ETA: ${eta})` : ''}</span>
      </Tooltip>
    </Marker>
  )
}

// We need to import Marker for StudentStopMarker
import { Marker } from 'react-leaflet'

export default function BusMapInner({
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  routePath,
  busLocation,
  stops,
  trail,
  showLiveBus = true,
  className,
  onMapClick,
  fleetBuses,
  interpolatedPosition,
  studentStop,
  eta,
}: BusMapProps) {
  useEffect(() => { injectLeafletCss() }, [])

  // Use interpolated position for bus if available, otherwise use busLocation
  const displayPosition = interpolatedPosition || busLocation

  // Stop markers - more refined
  const stopMarkers = useMemo(() => {
    if (!stops || stops.length === 0) return null

    return stops.map((stop, index) => {
      // Check if this is the student's stop (highlighted differently)
      const isStudentStop = studentStop && stop.name === studentStop.name
      if (isStudentStop) return null // Handled by StudentStopMarker

      let fillColor = '#9ca3af'
      let radius = 5
      let weight = 2

      if (index === 0) {
        fillColor = '#10b981'
        radius = 7
        weight = 2.5
      } else if (index === stops.length - 1) {
        fillColor = '#ef4444'
        radius = 7
        weight = 2.5
      }

      return (
        <CircleMarker
          key={`stop-${index}`}
          center={[stop.lat, stop.lng]}
          radius={radius}
          pathOptions={{
            fillColor,
            fillOpacity: 0.9,
            color: '#ffffff',
            weight,
            opacity: 1,
          }}
        >
          <Tooltip direction="top" offset={[0, -8]} permanent={false}>
            <span className="text-xs font-medium">{stop.name}</span>
          </Tooltip>
        </CircleMarker>
      )
    })
  }, [stops, studentStop])

  // Route progress - if bus is on route, show the portion already traveled differently
  const routeSegments = useMemo(() => {
    if (!routePath || routePath.length < 2) return { traveled: null, remaining: routePath }

    // If we have a bus position, try to find the closest point on the route
    if (displayPosition) {
      let closestIdx = 0
      let closestDist = Infinity
      for (let i = 0; i < routePath.length; i++) {
        const d = Math.sqrt(
          Math.pow(routePath[i][0] - displayPosition.lat, 2) +
          Math.pow(routePath[i][1] - displayPosition.lng, 2)
        )
        if (d < closestDist) {
          closestDist = d
          closestIdx = i
        }
      }
      // Split route into traveled and remaining
      const traveled = routePath.slice(0, closestIdx + 1)
      const remaining = routePath.slice(closestIdx)
      return { traveled: traveled.length > 1 ? traveled : null, remaining }
    }

    return { traveled: null, remaining: routePath }
  }, [routePath, displayPosition])

  return (
    <div className={`h-full w-full rounded-2xl overflow-hidden ${className ?? ''}`} style={{ minHeight: 250 }}>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={true}
        className="h-full w-full"
        style={{ minHeight: 250 }}
        zoomControl={false}
      >
        {/* Clean map tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Traveled route - solid green */}
        {routeSegments.traveled && routeSegments.traveled.length > 1 && (
          <Polyline
            positions={routeSegments.traveled}
            pathOptions={{
              color: '#10b981',
              weight: 5,
              opacity: 1,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        )}

        {/* Remaining route - dashed lighter green */}
        {routeSegments.remaining && routeSegments.remaining.length > 1 && (
          <Polyline
            positions={routeSegments.remaining}
            pathOptions={{
              color: '#10b981',
              weight: 4,
              opacity: 0.4,
              dashArray: '10 8',
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        )}

        {/* Full route as base (if no bus position) */}
        {!displayPosition && routePath && routePath.length > 1 && (
          <Polyline
            positions={routePath}
            pathOptions={{
              color: '#10b981',
              weight: 4,
              opacity: 0.8,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        )}

        {/* Trail - gradient-like effect using multiple polylines */}
        {trail && trail.length > 1 && (
          <Polyline
            positions={trail.map((t) => [t.lat, t.lng])}
            pathOptions={{
              color: '#10b981',
              weight: 3,
              opacity: 0.35,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        )}

        {/* Stop markers */}
        {stopMarkers}

        {/* Student's stop with ETA */}
        {studentStop && (
          <StudentStopMarker stop={studentStop} eta={eta} />
        )}

        {/* Single animated bus marker */}
        {showLiveBus && displayPosition && (
          <AnimatedMarker
            position={{ lat: displayPosition.lat, lng: displayPosition.lng }}
            heading={busLocation?.heading ?? 0}
            speed={busLocation?.speed ?? undefined}
            isLive={showLiveBus}
            showPulse={true}
            zIndexOffset={1000}
          />
        )}

        {/* Fleet bus markers */}
        {fleetBuses && fleetBuses.length > 0 && fleetBuses.map((fb) => (
          <AnimatedMarker
            key={`fleet-${fb.busId}`}
            position={{ lat: fb.lat, lng: fb.lng }}
            heading={fb.heading ?? 0}
            speed={fb.speed ?? undefined}
            color={fb.color ?? '#10b981'}
            label={fb.busName}
            isLive={fb.isLive}
            showPulse={fb.isLive}
            zIndexOffset={fb.isLive ? 1000 : 500}
          />
        ))}

        {/* Auto-fit bounds - only on initial load */}
        <MapBoundsFitter
          routePath={routePath}
          stops={stops}
          busLocation={displayPosition}
          fleetBuses={fleetBuses}
          initialFit={true}
        />

        <MapClickHandler onMapClick={onMapClick} />
      </MapContainer>
    </div>
  )
}
