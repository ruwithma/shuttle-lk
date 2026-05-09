'use client'

import { useEffect, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, Marker, useMap } from 'react-leaflet'
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
  followBus?: boolean // NEW: camera follows the bus
  showZoomControl?: boolean
}

const DEFAULT_CENTER: [number, number] = [7.8731, 80.7718]
const DEFAULT_ZOOM = 8

// Camera follow component - smoothly pans to follow the bus
function CameraFollower({
  target,
  enabled,
}: {
  target?: { lat: number; lng: number }
  enabled?: boolean
}) {
  const map = useMap()
  const prevTargetRef = useRef<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    if (!target || !enabled) return

    // Only animate if target actually changed
    const prev = prevTargetRef.current
    if (prev && Math.abs(prev.lat - target.lat) < 0.00001 && Math.abs(prev.lng - target.lng) < 0.00001) {
      return
    }

    prevTargetRef.current = target

    // Smooth pan to new position
    map.panTo([target.lat, target.lng], {
      animate: true,
      duration: 1.2,
      easeLinearity: 0.25,
    })
  }, [target, enabled, map])

  return null
}

// Component to auto-fit map bounds
function MapBoundsFitter({
  routePath,
  stops,
  busLocation,
  fleetBuses,
  shouldFit,
}: {
  routePath?: [number, number][]
  stops?: { name: string; lat: number; lng: number }[]
  busLocation?: { lat: number; lng: number }
  fleetBuses?: FleetBus[]
  shouldFit?: boolean
}) {
  const map = useMap()
  const hasFitted = useRef(false)

  const bounds = useMemo(() => {
    const points: L.LatLngTuple[] = []
    if (routePath && routePath.length > 0) points.push(...routePath)
    if (stops && stops.length > 0) stops.forEach((s) => points.push([s.lat, s.lng]))
    if (busLocation) points.push([busLocation.lat, busLocation.lng])
    if (fleetBuses && fleetBuses.length > 0) fleetBuses.forEach((fb) => points.push([fb.lat, fb.lng]))
    return points
  }, [routePath, stops, busLocation, fleetBuses])

  useEffect(() => {
    if (shouldFit && !hasFitted.current && bounds.length > 0) {
      const latLngBounds = L.latLngBounds(bounds)
      map.fitBounds(latLngBounds, { padding: [50, 50], maxZoom: 15 })
      hasFitted.current = true
    }
  }, [shouldFit, bounds, map])

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
    const etaHtml = eta ? `<div style="background:#1a1a2e;color:white;font-size:9px;font-weight:800;padding:2px 6px;border-radius:6px;white-space:nowrap;margin-top:3px;font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;letter-spacing:0.3px;box-shadow:0 1px 4px rgba(0,0,0,0.2);">ETA ${eta}</div>` : ''
    const html = `
      <div style="display:flex;flex-direction:column;align-items:center;">
        <div style="width:16px;height:16px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(59,130,246,0.5);"></div>
        ${etaHtml}
      </div>
    `
    return L.divIcon({ html, className: '', iconSize: [16, 16], iconAnchor: [8, 8] })
  }, [eta])

  return (
    <Marker
      position={[stop.lat, stop.lng]}
      icon={icon}
      zIndexOffset={900}
    >
      <Tooltip direction="top" offset={[0, -12]} permanent={false}>
        <span className="text-xs font-bold text-blue-700">{stop.name} {eta ? `(ETA: ${eta})` : ''}</span>
      </Tooltip>
    </Marker>
  )
}

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
  followBus = false,
  showZoomControl = false,
}: BusMapProps) {
  useEffect(() => { injectLeafletCss() }, [])

  // Use interpolated position for bus if available, otherwise use busLocation
  const displayPosition = interpolatedPosition || busLocation

  // Stop markers
  const stopMarkers = useMemo(() => {
    if (!stops || stops.length === 0) return null

    return stops.map((stop, index) => {
      const isStudentStop = studentStop && stop.name === studentStop.name
      if (isStudentStop) return null

      let fillColor = '#9ca3af'
      let radius = 4
      let weight = 2

      if (index === 0) {
        fillColor = '#10b981'
        radius = 7
        weight = 3
      } else if (index === stops.length - 1) {
        fillColor = '#ef4444'
        radius = 7
        weight = 3
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
            <span className="text-xs font-semibold">{stop.name}</span>
          </Tooltip>
        </CircleMarker>
      )
    })
  }, [stops, studentStop])

  // Route segments
  const routeSegments = useMemo(() => {
    if (!routePath || routePath.length < 2) return { traveled: null, remaining: routePath }

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
        zoomControl={showZoomControl}
      >
        {/* Clean CartoDB tiles - much cleaner than default OSM, Uber-like style */}
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
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

        {/* Remaining route - dashed lighter */}
        {routeSegments.remaining && routeSegments.remaining.length > 1 && (
          <Polyline
            positions={routeSegments.remaining}
            pathOptions={{
              color: '#10b981',
              weight: 4,
              opacity: 0.35,
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

        {/* Trail - subtle breadcrumb */}
        {trail && trail.length > 1 && (
          <Polyline
            positions={trail.map((t) => [t.lat, t.lng])}
            pathOptions={{
              color: '#10b981',
              weight: 3,
              opacity: 0.25,
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

        {/* Single animated bus marker - Uber quality */}
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

        {/* Camera follows bus when followBus is enabled */}
        <CameraFollower
          target={displayPosition ? { lat: displayPosition.lat, lng: displayPosition.lng } : undefined}
          enabled={followBus && !!displayPosition}
        />

        {/* Auto-fit bounds - only on initial load */}
        <MapBoundsFitter
          routePath={routePath}
          stops={stops}
          busLocation={displayPosition}
          fleetBuses={fleetBuses}
          shouldFit={true}
        />

        <MapClickHandler onMapClick={onMapClick} />
      </MapContainer>
    </div>
  )
}
