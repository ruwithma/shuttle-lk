'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useTheme } from 'next-themes'

// ─── Types ───────────────────────────────────────────────────────────────────

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

export interface StopInfo {
  name: string
  lat: number
  lng: number
  estimatedMinutes?: number
}

interface ShuttleMapProps {
  center?: [number, number] // [lat, lng]
  zoom?: number
  routePath?: [number, number][] // [lat, lng] pairs
  busLocation?: { lat: number; lng: number; heading?: number; speed?: number }
  stops?: StopInfo[]
  trail?: { lat: number; lng: number }[]
  showLiveBus?: boolean
  className?: string
  onMapClick?: (lat: number, lng: number) => void
  fleetBuses?: FleetBus[]
  interpolatedPosition?: { lat: number; lng: number } | null
  studentStop?: StopInfo | null
  eta?: string | null
  followBus?: boolean
  showZoomControl?: boolean
  darkMode?: boolean
}

const DEFAULT_CENTER: [number, number] = [7.8731, 80.7718] // Sri Lanka center
const DEFAULT_ZOOM = 8

// ─── Tile URLs ───────────────────────────────────────────────────────────────

const LIGHT_TILE_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png'
const DARK_TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'
const TILE_ATTRIBUTION = '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'

// ─── Inject CSS for animations and Leaflet ───────────────────────────────────

let cssInjected = false

function injectRequiredCSS() {
  if (cssInjected) return
  cssInjected = true

  // Fix Leaflet default icon issue (markers show broken images without this)
  // @ts-expect-error Leaflet internal icon paths
  delete L.Icon.Default.prototype._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  })

  // Animation keyframes and marker styles
  if (!document.getElementById('shuttle-map-keyframes')) {
    const style = document.createElement('style')
    style.id = 'shuttle-map-keyframes'
    style.textContent = `
      @keyframes uberPulse {
        0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.8; }
        100% { transform: translate(-50%, -50%) scale(2.5); opacity: 0; }
      }
      @keyframes livePulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(0.85); }
      }
      .shuttle-bus-marker {
        transition: transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      .leaflet-container {
        font-family: inherit;
      }
    `
    document.head.appendChild(style)
  }
}

// ─── Bus SVG Icon String ─────────────────────────────────────────────────────

function busSVGString(color: string = '#10b981'): string {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="none">
    <rect x="4" y="3" width="16" height="14" rx="3" fill="white"/>
    <rect x="6" y="5" width="5" height="5" rx="1" fill="${color}" opacity="0.3"/>
    <rect x="13" y="5" width="5" height="5" rx="1" fill="${color}" opacity="0.3"/>
    <rect x="6" y="12" width="12" height="3" rx="1" fill="${color}" opacity="0.15"/>
    <circle cx="8" cy="19" r="2" fill="white"/>
    <circle cx="16" cy="19" r="2" fill="white"/>
    <rect x="3" y="8" width="2" height="4" rx="1" fill="white" opacity="0.8"/>
    <rect x="19" y="8" width="2" height="4" rx="1" fill="white" opacity="0.8"/>
  </svg>`
}

// ─── Custom Icon Factories ───────────────────────────────────────────────────

function createStopIcon(
  stop: StopInfo,
  index: number,
  totalStops: number,
  isStudent: boolean,
  isDark: boolean,
  eta?: string | null
): L.DivIcon {
  let size = 12
  let bgColor = '#9ca3af'
  let borderWidth = 2
  let shadow = '0 1px 3px rgba(0,0,0,0.2)'

  if (index === 0) {
    size = 18
    bgColor = '#10b981'
    borderWidth = 3
    shadow = '0 2px 6px rgba(16,185,129,0.4)'
  } else if (index === totalStops - 1) {
    size = 18
    bgColor = '#ef4444'
    borderWidth = 3
    shadow = '0 2px 6px rgba(239,68,68,0.4)'
  } else if (isStudent) {
    size = 20
    bgColor = '#3b82f6'
    borderWidth = 3
    shadow = '0 2px 8px rgba(59,130,246,0.5)'
  }

  const timeText = stop.estimatedMinutes != null
    ? `${stop.estimatedMinutes} min`
    : (isStudent && eta ? eta : '')

  const timeLabel = (stop.estimatedMinutes != null || isStudent) && timeText
    ? `<div style="
        position:absolute;
        top:${size + 4}px;
        left:50%;
        transform:translateX(-50%);
        background:${isDark ? '#1f2937' : '#111827'};
        color:white;
        font-size:9px;
        font-weight:800;
        padding:2px 6px;
        border-radius:6px;
        white-space:nowrap;
        font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;
        letter-spacing:0.3px;
        box-shadow:0 1px 4px rgba(0,0,0,0.3);
        pointer-events:none;
      ">${timeText}</div>`
    : ''

  const html = `
    <div style="position:relative;cursor:pointer;">
      <div style="
        width:${size}px;
        height:${size}px;
        background:${bgColor};
        border:${borderWidth}px solid #ffffff;
        border-radius:50%;
        box-shadow:${shadow};
      "></div>
      <div style="
        position:absolute;
        bottom:${size + 4}px;
        left:50%;
        transform:translateX(-50%);
        background:${isDark ? '#374151' : '#ffffff'};
        color:${isDark ? '#f3f4f6' : '#111827'};
        font-size:10px;
        font-weight:600;
        padding:2px 8px;
        border-radius:6px;
        white-space:nowrap;
        box-shadow:0 2px 8px rgba(0,0,0,0.15);
        opacity:0;
        transition:opacity 0.2s;
        pointer-events:none;
      " class="stop-name-tooltip">${stop.name}</div>
      ${timeLabel}
    </div>
  `

  return L.divIcon({
    html,
    className: '',
    iconSize: [size + 20, size + 40],
    iconAnchor: [(size + 20) / 2, (size + 20) / 2],
  })
}

function createBusIcon(
  heading: number = 0,
  speed?: number,
  isLive: boolean = true,
  color: string = '#10b981'
): L.DivIcon {
  const hex = color.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  const pulseHTML = isLive ? `
    <div style="
      position:absolute;
      width:56px;
      height:56px;
      border-radius:50%;
      background:rgba(${r},${g},${b},0.2);
      animation:uberPulse 2s cubic-bezier(0.4,0,0.6,1) infinite;
      top:50%;left:50%;
      transform:translate(-50%,-50%);
    "></div>
    <div style="
      position:absolute;
      width:56px;
      height:56px;
      border-radius:50%;
      background:rgba(${r},${g},${b},0.2);
      animation:uberPulse 2s cubic-bezier(0.4,0,0.6,1) infinite 0.6s;
      top:50%;left:50%;
      transform:translate(-50%,-50%);
    "></div>
  ` : ''

  const speedBadge = (speed != null && speed > 0) ? `
    <div class="bus-speed-badge" style="
      position:absolute;
      top:-6px;
      right:-6px;
      background:#1a1a2e;
      color:white;
      font-size:9px;
      font-weight:800;
      padding:2px 5px;
      border-radius:8px;
      white-space:nowrap;
      font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;
      box-shadow:0 1px 4px rgba(0,0,0,0.3);
      letter-spacing:0.3px;
      z-index:3;
    ">${Math.round(speed)}<span style="font-size:7px;font-weight:600;opacity:0.8">km/h</span></div>
  ` : ''

  const liveDot = isLive ? `
    <div style="
      position:absolute;
      top:-3px;
      left:-3px;
      width:10px;
      height:10px;
      background:#ef4444;
      border-radius:50%;
      border:2px solid white;
      box-shadow:0 0 4px rgba(239,68,68,0.6);
      animation:livePulse 1.5s ease-in-out infinite;
      z-index:3;
    "></div>
  ` : ''

  const html = `
    <div style="
      position:relative;
      width:44px;
      height:44px;
      display:flex;
      align-items:center;
      justify-content:center;
      cursor:pointer;
    ">
      ${pulseHTML}
      <div class="bus-icon-inner" style="
        width:40px;
        height:40px;
        border-radius:50%;
        background:${color};
        display:flex;
        align-items:center;
        justify-content:center;
        box-shadow:0 3px 14px rgba(${r},${g},${b},0.4),0 0 0 3px rgba(255,255,255,0.95);
        transform:rotate(${heading}deg);
        border:3px solid white;
        transition:transform 0.6s cubic-bezier(0.34,1.56,0.64,1);
        position:relative;
        z-index:2;
      ">
        ${busSVGString(color)}
      </div>
      ${speedBadge}
      ${liveDot}
    </div>
  `

  return L.divIcon({
    html,
    className: '',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  })
}

function createFleetBusIcon(
  busName: string,
  heading: number = 0,
  speed?: number,
  isLive: boolean = true,
  color: string = '#10b981',
  isDark: boolean = false
): L.DivIcon {
  const hex = color.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  const pulseHTML = isLive ? `
    <div style="
      position:absolute;
      width:56px;
      height:56px;
      border-radius:50%;
      background:rgba(${r},${g},${b},0.2);
      animation:uberPulse 2s cubic-bezier(0.4,0,0.6,1) infinite;
      top:50%;left:50%;
      transform:translate(-50%,-50%);
    "></div>
    <div style="
      position:absolute;
      width:56px;
      height:56px;
      border-radius:50%;
      background:rgba(${r},${g},${b},0.2);
      animation:uberPulse 2s cubic-bezier(0.4,0,0.6,1) infinite 0.6s;
      top:50%;left:50%;
      transform:translate(-50%,-50%);
    "></div>
  ` : ''

  const speedBadge = (speed != null && speed > 0) ? `
    <div class="bus-speed-badge" style="
      position:absolute;
      top:-6px;
      right:-6px;
      background:#1a1a2e;
      color:white;
      font-size:9px;
      font-weight:800;
      padding:2px 5px;
      border-radius:8px;
      white-space:nowrap;
      font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;
      box-shadow:0 1px 4px rgba(0,0,0,0.3);
      letter-spacing:0.3px;
      z-index:3;
    ">${Math.round(speed)}<span style="font-size:7px;font-weight:600;opacity:0.8">km/h</span></div>
  ` : ''

  const nameLabel = busName ? `
    <div style="
      position:absolute;
      top:calc(100% + 3px);
      left:50%;
      transform:translateX(-50%);
      background:${isDark ? '#1f2937' : '#111827'};
      color:white;
      font-size:10px;
      font-weight:700;
      padding:2px 8px;
      border-radius:8px;
      white-space:nowrap;
      box-shadow:0 2px 8px rgba(0,0,0,0.3);
      pointer-events:none;
    ">${busName}</div>
  ` : ''

  const html = `
    <div style="
      position:relative;
      width:44px;
      height:44px;
      display:flex;
      align-items:center;
      justify-content:center;
      cursor:pointer;
    ">
      ${pulseHTML}
      <div class="bus-icon-inner" style="
        width:40px;
        height:40px;
        border-radius:50%;
        background:${color};
        display:flex;
        align-items:center;
        justify-content:center;
        box-shadow:0 3px 14px rgba(${r},${g},${b},0.4),0 0 0 3px rgba(255,255,255,0.95);
        transform:rotate(${heading}deg);
        border:3px solid white;
        transition:transform 0.6s cubic-bezier(0.34,1.56,0.64,1);
        position:relative;
        z-index:2;
      ">
        ${busSVGString(color)}
      </div>
      ${speedBadge}
      ${nameLabel}
    </div>
  `

  return L.divIcon({
    html,
    className: '',
    iconSize: [44, 56],
    iconAnchor: [22, 22],
  })
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

/** Handles camera follow logic */
function CameraFollow({ followBus, position }: { followBus: boolean; position: { lat: number; lng: number } | null | undefined }) {
  const map = useMap()

  useEffect(() => {
    if (!followBus || !position) return
    map.flyTo([position.lat, position.lng], map.getZoom(), { duration: 1.2 })
  }, [followBus, position, map])

  return null
}

/** Handles map click events */
function MapClickHandler({ onMapClick }: { onMapClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick?.(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

/** Handles fitting bounds to show all relevant markers and route */
function FitBoundsHandler({
  routePath,
  stops,
  displayPosition,
  fleetBuses,
}: {
  routePath?: [number, number][]
  stops?: StopInfo[]
  displayPosition?: { lat: number; lng: number } | null
  fleetBuses?: FleetBus[]
}) {
  const map = useMap()
  const hasFittedRef = useRef(false)

  useEffect(() => {
    if (hasFittedRef.current) return

    const latlngs: L.LatLngExpression[] = []

    if (routePath && routePath.length > 0) {
      routePath.forEach(([lat, lng]) => latlngs.push([lat, lng]))
    }
    if (stops && stops.length > 0) {
      stops.forEach(s => latlngs.push([s.lat, s.lng]))
    }
    if (displayPosition) {
      latlngs.push([displayPosition.lat, displayPosition.lng])
    }
    if (fleetBuses && fleetBuses.length > 0) {
      fleetBuses.forEach(fb => latlngs.push([fb.lat, fb.lng]))
    }

    if (latlngs.length === 0) return

    const bounds = L.latLngBounds(latlngs)
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 })
    hasFittedRef.current = true
  }, [routePath, stops, displayPosition, fleetBuses, map])

  return null
}

/** Handles hover tooltip for stop markers */
function StopMarkerWithTooltip({ stop, index, totalStops, isStudent, isDark, eta }: {
  stop: StopInfo
  index: number
  totalStops: number
  isStudent: boolean
  isDark: boolean
  eta?: string | null
}) {
  const icon = useMemo(
    () => createStopIcon(stop, index, totalStops, isStudent, isDark, eta),
    [stop, index, totalStops, isStudent, isDark, eta]
  )

  return (
    <Marker position={[stop.lat, stop.lng]} icon={icon}>
      <Popup>
        <div className="text-center">
          <div className="font-semibold text-sm">{stop.name}</div>
          {stop.estimatedMinutes != null && (
            <div className="text-xs text-gray-500 mt-1">{stop.estimatedMinutes} min away</div>
          )}
        </div>
      </Popup>
    </Marker>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ShuttleMap({
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
  darkMode: darkModeProp,
}: ShuttleMapProps) {
  const { resolvedTheme } = useTheme()
  const isDark = darkModeProp ?? resolvedTheme === 'dark'
  const displayPosition = interpolatedPosition || busLocation

  // Inject CSS and fix icons on mount
  const [cssReady, setCssReady] = useState(false)
  useEffect(() => {
    injectRequiredCSS()
    setCssReady(true)
  }, [])

  // Compute traveled portion of the route
  const traveledPath = useMemo(() => {
    if (!routePath || routePath.length < 2 || !displayPosition) return null

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
    if (traveled.length < 2) return null
    return traveled as [number, number][]
  }, [routePath, displayPosition])

  // Convert routePath to LatLng tuples for Leaflet (already [lat, lng])
  const routeLatLngs = useMemo(() => {
    if (!routePath || routePath.length < 2) return null
    return routePath as L.LatLngExpression[]
  }, [routePath])

  // Trail latlngs
  const trailLatLngs = useMemo(() => {
    if (!trail || trail.length < 2) return null
    return trail.map(t => [t.lat, t.lng] as L.LatLngExpression)
  }, [trail])

  // Determine if we should show the solid route (no bus) or dashed
  const hasBus = !!displayPosition

  // Bus marker icon - recreate when heading/speed/isLive changes
  const busIcon = useMemo(() => {
    if (!showLiveBus || !displayPosition) return null
    return createBusIcon(
      busLocation?.heading ?? 0,
      busLocation?.speed,
      true,
      '#10b981'
    )
  }, [showLiveBus, displayPosition, busLocation?.heading, busLocation?.speed])

  if (!cssReady) {
    return (
      <div className={`h-full w-full rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse flex items-center justify-center ${className ?? ''}`} style={{ minHeight: 250 }}>
        <span className="text-sm text-muted-foreground">Loading map...</span>
      </div>
    )
  }

  try {
    return (
      <div className={`h-full w-full rounded-2xl overflow-hidden ${className ?? ''}`} style={{ minHeight: 250 }}>
        <MapContainer
          center={center}
          zoom={zoom}
          className="h-full w-full"
          style={{ minHeight: 250 }}
          zoomControl={showZoomControl}
          attributionControl={true}
        >
          <TileLayer
            key={isDark ? 'dark' : 'light'}
            url={isDark ? DARK_TILE_URL : LIGHT_TILE_URL}
            attribution={TILE_ATTRIBUTION}
            maxZoom={19}
          />

          {/* Map click handler */}
          {onMapClick && <MapClickHandler onMapClick={onMapClick} />}

          {/* Camera follow */}
          <CameraFollow followBus={followBus} position={displayPosition} />

          {/* Fit bounds */}
          <FitBoundsHandler
            routePath={routePath}
            stops={stops}
            displayPosition={displayPosition}
            fleetBuses={fleetBuses}
          />

          {/* Route glow line (wide, semi-transparent) */}
          {routeLatLngs && (
            <Polyline
              positions={routeLatLngs}
              pathOptions={{
                color: '#10b981',
                weight: 12,
                opacity: 0.15,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          )}

          {/* Route dashed line */}
          {routeLatLngs && hasBus && (
            <Polyline
              positions={routeLatLngs}
              pathOptions={{
                color: '#10b981',
                weight: 4,
                opacity: 0.4,
                dashArray: '4 3',
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          )}

          {/* Route solid line (when no bus) */}
          {routeLatLngs && !hasBus && (
            <Polyline
              positions={routeLatLngs}
              pathOptions={{
                color: '#10b981',
                weight: 4,
                opacity: 0.9,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          )}

          {/* Traveled portion glow */}
          {traveledPath && (
            <Polyline
              positions={traveledPath}
              pathOptions={{
                color: '#10b981',
                weight: 10,
                opacity: 0.25,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          )}

          {/* Traveled portion solid */}
          {traveledPath && (
            <Polyline
              positions={traveledPath}
              pathOptions={{
                color: '#10b981',
                weight: 5,
                opacity: 1,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          )}

          {/* Trail line */}
          {trailLatLngs && (
            <Polyline
              positions={trailLatLngs}
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
          {stops && stops.length > 0 && stops.map((stop, index) => (
            <StopMarkerWithTooltip
              key={`stop-${index}-${stop.name}`}
              stop={stop}
              index={index}
              totalStops={stops.length}
              isStudent={!!studentStop && stop.name === studentStop.name}
              isDark={isDark}
              eta={eta}
            />
          ))}

          {/* Main bus marker */}
          {showLiveBus && displayPosition && busIcon && (
            <Marker
              position={[displayPosition.lat, displayPosition.lng]}
              icon={busIcon}
            >
              <Popup>
                <div className="text-center">
                  <div className="font-semibold text-sm">Live Bus</div>
                  {busLocation?.speed != null && (
                    <div className="text-xs text-gray-500 mt-1">{Math.round(busLocation.speed)} km/h</div>
                  )}
                </div>
              </Popup>
            </Marker>
          )}

          {/* Fleet bus markers */}
          {fleetBuses && fleetBuses.length > 0 && fleetBuses.map(fb => {
            const icon = createFleetBusIcon(
              fb.busName,
              fb.heading ?? 0,
              fb.speed,
              fb.isLive,
              fb.color ?? '#10b981',
              isDark
            )
            return (
              <Marker
                key={`fleet-${fb.busId}`}
                position={[fb.lat, fb.lng]}
                icon={icon}
              >
                <Popup>
                  <div className="text-center">
                    <div className="font-semibold text-sm">{fb.busName}</div>
                    {fb.plateNumber && (
                      <div className="text-xs text-gray-500">{fb.plateNumber}</div>
                    )}
                    {fb.driverName && (
                      <div className="text-xs text-gray-500">Driver: {fb.driverName}</div>
                    )}
                    {fb.speed != null && (
                      <div className="text-xs text-gray-500">{Math.round(fb.speed)} km/h</div>
                    )}
                    {fb.isLive && (
                      <div className="text-xs text-green-600 font-medium mt-1">● Live</div>
                    )}
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>
      </div>
    )
  } catch (error) {
    console.error('ShuttleMap render error:', error)
    return (
      <div className={`h-full w-full rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center ${className ?? ''}`} style={{ minHeight: 250 }}>
        <span className="text-sm text-muted-foreground">Map unavailable</span>
      </div>
    )
  }
}
