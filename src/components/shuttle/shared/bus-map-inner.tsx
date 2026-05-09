'use client'

import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'

// Dynamically inject Leaflet CSS only when the map component mounts
let leafletCssInjected = false
function injectLeafletCss() {
  if (leafletCssInjected) return
  if (typeof document === 'undefined') return
  // Check if already present (e.g. from SSR head)
  const existing = document.querySelector('link[href*="leaflet"]')
  if (existing) {
    leafletCssInjected = true
    return
  }
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
}

// Default center: Sri Lanka
const DEFAULT_CENTER: [number, number] = [7.8731, 80.7718]
const DEFAULT_ZOOM = 8

// Custom bus icon with pulsing animation
function createBusIcon(heading?: number, color?: string) {
  const rotation = heading ?? 0
  const bgColor = color ?? '#10b981'
  const bgRgba = color
    ? `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0.25)`
    : 'rgba(16, 185, 129, 0.25)'
  const shadowRgba = color
    ? `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0.5)`
    : 'rgba(16, 185, 129, 0.5)'

  const html = `
    <div style="position: relative; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
      <div style="
        position: absolute;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: ${bgRgba};
        animation: busPulse 2s ease-out infinite;
      "></div>
      <div style="
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: ${bgColor};
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px ${shadowRgba};
        transform: rotate(${rotation}deg);
        border: 2px solid white;
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 6v6"/>
          <path d="M16 6v6"/>
          <path d="M2 12h20"/>
          <path d="M4 18h2"/>
          <path d="M18 18h2"/>
          <rect x="3" y="2" width="18" height="18" rx="2"/>
        </svg>
      </div>
      <style>
        @keyframes busPulse {
          0% { transform: scale(0.8); opacity: 1; }
          100% { transform: scale(2); opacity: 0; }
        }
      </style>
    </div>
  `

  return L.divIcon({
    html,
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  })
}

// Component to auto-fit map bounds when data changes
function MapBoundsFitter({
  routePath,
  stops,
  busLocation,
  trail,
  fleetBuses,
}: {
  routePath?: [number, number][]
  stops?: { name: string; lat: number; lng: number }[]
  busLocation?: { lat: number; lng: number }
  trail?: { lat: number; lng: number }[]
  fleetBuses?: FleetBus[]
}) {
  const map = useMap()

  const bounds = useMemo(() => {
    const points: L.LatLngTuple[] = []

    if (routePath && routePath.length > 0) {
      points.push(...routePath)
    }

    if (stops && stops.length > 0) {
      stops.forEach((s) => points.push([s.lat, s.lng]))
    }

    if (busLocation) {
      points.push([busLocation.lat, busLocation.lng])
    }

    if (trail && trail.length > 0) {
      trail.forEach((t) => points.push([t.lat, t.lng]))
    }

    if (fleetBuses && fleetBuses.length > 0) {
      fleetBuses.forEach((fb) => points.push([fb.lat, fb.lng]))
    }

    return points
  }, [routePath, stops, busLocation, trail, fleetBuses])

  useEffect(() => {
    if (bounds.length > 0) {
      const latLngBounds = L.latLngBounds(bounds)
      map.fitBounds(latLngBounds, { padding: [30, 30], maxZoom: 15 })
    }
  }, [bounds, map])

  return null
}

// Click handler component
function MapClickHandler({ onMapClick }: { onMapClick?: (lat: number, lng: number) => void }) {
  const map = useMap()

  useEffect(() => {
    if (!onMapClick) return

    const handleClick = (e: L.LeafletMouseEvent) => {
      onMapClick(e.latlng.lat, e.latlng.lng)
    }

    map.on('click', handleClick)
    return () => {
      map.off('click', handleClick)
    }
  }, [map, onMapClick])

  return null
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
}: BusMapProps) {
  // Inject Leaflet CSS on first mount
  useEffect(() => {
    injectLeafletCss()
  }, [])

  const busIcon = useMemo(() => createBusIcon(busLocation?.heading), [busLocation?.heading])

  const stopMarkers = useMemo(() => {
    if (!stops || stops.length === 0) return null

    return stops.map((stop, index) => {
      let fillColor = '#6b7280' // gray for middle stops
      let fillOpacity = 0.8
      let radius = 6

      if (index === 0) {
        // Start stop - green
        fillColor = '#10b981'
        fillOpacity = 1
        radius = 8
      } else if (index === stops.length - 1) {
        // End stop - red
        fillColor = '#ef4444'
        fillOpacity = 1
        radius = 8
      }

      return (
        <CircleMarker
          key={`stop-${index}`}
          center={[stop.lat, stop.lng]}
          radius={radius}
          pathOptions={{
            fillColor,
            fillOpacity,
            color: '#ffffff',
            weight: 2,
            opacity: 1,
          }}
        >
          <Tooltip
            direction="top"
            offset={[0, -8]}
            className="font-sans text-xs"
            permanent={false}
          >
            <span className="text-xs font-medium">{stop.name}</span>
          </Tooltip>
        </CircleMarker>
      )
    })
  }, [stops])

  return (
    <div className={`h-full w-full rounded-2xl overflow-hidden ${className ?? ''}`} style={{ minHeight: 250 }}>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={true}
        className="h-full w-full"
        style={{ minHeight: 250 }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Route path polyline */}
        {routePath && routePath.length > 1 && (
          <Polyline
            positions={routePath}
            pathOptions={{
              color: '#10b981',
              weight: 4,
              opacity: 0.9,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        )}

        {/* Trail dashed polyline */}
        {trail && trail.length > 1 && (
          <Polyline
            positions={trail.map((t) => [t.lat, t.lng])}
            pathOptions={{
              color: '#10b981',
              weight: 2,
              opacity: 0.5,
              dashArray: '8 6',
              lineCap: 'round',
            }}
          />
        )}

        {/* Stop markers */}
        {stopMarkers}

        {/* Bus marker */}
        {showLiveBus && busLocation && (
          <Marker
            position={[busLocation.lat, busLocation.lng]}
            icon={busIcon}
            zIndexOffset={1000}
          />
        )}

        {/* Fleet bus markers */}
        {fleetBuses && fleetBuses.length > 0 && fleetBuses.map((fb) => (
          <Marker
            key={`fleet-${fb.busId}`}
            position={[fb.lat, fb.lng]}
            icon={createBusIcon(fb.heading, fb.color)}
            zIndexOffset={fb.isLive ? 1000 : 500}
          >
            <Tooltip direction="top" offset={[0, -20]} className="font-sans">
              <div className="text-xs">
                <p className="font-semibold">{fb.busName}</p>
                <p className="text-gray-500">{fb.plateNumber}</p>
                {fb.driverName && <p className="text-gray-500">Driver: {fb.driverName}</p>}
                {fb.lastUpdate && <p className="text-gray-400">{fb.lastUpdate}</p>}
                <p className={fb.isLive ? 'text-emerald-600 font-medium' : 'text-gray-400'}>
                  {fb.isLive ? '● Live' : '○ Offline'}
                </p>
              </div>
            </Tooltip>
          </Marker>
        ))}

        {/* Auto-fit bounds */}
        <MapBoundsFitter
          routePath={routePath}
          stops={stops}
          busLocation={busLocation}
          trail={trail}
          fleetBuses={fleetBuses}
        />

        {/* Click handler */}
        <MapClickHandler onMapClick={onMapClick} />
      </MapContainer>
    </div>
  )
}
