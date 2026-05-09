'use client'

import { useEffect, useRef, useCallback, useMemo } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
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

// ─── Minimal Uber-like Map Styles ────────────────────────────────────────────

// Light style - clean, minimal like Uber
const LIGHT_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    'carto-light': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'carto-light-layer',
      type: 'raster',
      source: 'carto-light',
      minzoom: 0,
      maxzoom: 19,
      paint: {
        'raster-brightness-max': 1,
        'raster-saturation': -0.3,
        'raster-contrast': 0.1,
      },
    },
  ],
}

// Dark style - sleek dark mode like Uber night
const DARK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    'carto-dark': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'carto-dark-layer',
      type: 'raster',
      source: 'carto-dark',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
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
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])
  const popupsRef = useRef<maplibregl.Popup[]>([])
  const prevBusPosRef = useRef<{ lat: number; lng: number } | null>(null)
  const animFrameRef = useRef<number>(0)
  const markerPosRef = useRef<{ lat: number; lng: number } | null>(null)
  const initializedRef = useRef(false)

  const displayPosition = interpolatedPosition || busLocation

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: isDark ? DARK_STYLE : LIGHT_STYLE,
      center: [center[1], center[0]], // MapLibre uses [lng, lat]
      zoom: zoom,
      attributionControl: false,
      navigationControl: false,
    })

    if (showZoomControl) {
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    }

    // Add compact attribution
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')

    map.on('load', () => {
      initializedRef.current = true
    })

    // Click handler
    if (onMapClick) {
      map.on('click', (e) => {
        onMapClick(e.lngLat.lat, e.lngLat.lng)
      })
    }

    mapRef.current = map

    return () => {
      // Cleanup markers
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []
      popupsRef.current.forEach(p => p.remove())
      popupsRef.current = []
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
      map.remove()
      mapRef.current = null
      initializedRef.current = false
    }
  }, []) // Only init once

  // Update map style on theme change
  useEffect(() => {
    const map = mapRef.current
    if (!map || !initializedRef.current) return

    const currentCenter = map.getCenter()
    const currentZoom = map.getZoom()

    map.setStyle(isDark ? DARK_STYLE : LIGHT_STYLE)

    // Restore position after style change
    map.once('style.load', () => {
      map.setCenter(currentCenter)
      map.setZoom(currentZoom)
    })
  }, [isDark])

  // ─── Route Line Layer ─────────────────────────────────────────────────────

  // Convert [lat, lng] route path to GeoJSON Feature
  const routeGeoJSON = useMemo(() => {
    if (!routePath || routePath.length < 2) return null
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: routePath.map(([lat, lng]) => [lng, lat]), // MapLibre order
      },
    }
  }, [routePath])

  // Traveled portion of route
  const traveledGeoJSON = useMemo(() => {
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

    return {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: traveled.map(([lat, lng]) => [lng, lat]),
      },
    }
  }, [routePath, displayPosition])

  // Update route layers
  useEffect(() => {
    const map = mapRef.current
    if (!map || !initializedRef.current) return

    const updateLayers = () => {
      // Remove existing layers/sources
      ;['route-glow', 'route-line', 'route-traveled-glow', 'route-traveled', 'route-dash'].forEach(id => {
        if (map.getLayer(id)) map.removeLayer(id)
      })
      ;['route-source', 'route-traveled-source'].forEach(id => {
        if (map.getSource(id)) map.removeSource(id)
      })

      if (routeGeoJSON) {
        // Full route source
        map.addSource('route-source', {
          type: 'geojson',
          data: routeGeoJSON,
        })

        // Route glow (wider, semi-transparent)
        map.addLayer({
          id: 'route-glow',
          type: 'line',
          source: 'route-source',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': isDark ? '#10b981' : '#10b981',
            'line-width': 12,
            'line-opacity': 0.15,
            'line-blur': 6,
          },
        })

        // Route line (dashed for remaining portion)
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route-source',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': isDark ? '#10b981' : '#10b981',
            'line-width': 4,
            'line-opacity': 0.4,
            'line-dasharray': [0, 4, 3],
          },
        })
      }

      // Traveled portion (solid, bright)
      if (traveledGeoJSON) {
        map.addSource('route-traveled-source', {
          type: 'geojson',
          data: traveledGeoJSON,
        })

        // Traveled glow
        map.addLayer({
          id: 'route-traveled-glow',
          type: 'line',
          source: 'route-traveled-source',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#10b981',
            'line-width': 10,
            'line-opacity': 0.25,
            'line-blur': 4,
          },
        })

        // Traveled solid line
        map.addLayer({
          id: 'route-traveled',
          type: 'line',
          source: 'route-traveled-source',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#10b981',
            'line-width': 5,
            'line-opacity': 1,
          },
        })
      }

      // Animated dash layer on top of route
      if (routeGeoJSON && !displayPosition) {
        map.addLayer({
          id: 'route-dash',
          type: 'line',
          source: 'route-source',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#10b981',
            'line-width': 4,
            'line-opacity': 0.9,
          },
        })
      }
    }

    if (map.isStyleLoaded()) {
      updateLayers()
    } else {
      map.once('style.load', updateLayers)
    }
  }, [routeGeoJSON, traveledGeoJSON, displayPosition, isDark])

  // ─── Stop Markers ────────────────────────────────────────────────────────

  // Update stop markers
  useEffect(() => {
    const map = mapRef.current
    if (!map || !initializedRef.current || !stops || stops.length === 0) return

    const updateStops = () => {
      // Remove existing stop markers
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []
      popupsRef.current.forEach(p => p.remove())
      popupsRef.current = []

      stops.forEach((stop, index) => {
        const isStudent = studentStop && stop.name === studentStop.name
        const isFirst = index === 0
        const isLast = index === stops.length - 1

        // Create marker element
        const el = document.createElement('div')
        el.className = 'shuttle-stop-marker'

        let size = 12
        let bgColor = '#9ca3af'
        let borderColor = '#ffffff'
        let borderWidth = 2
        let shadow = '0 1px 3px rgba(0,0,0,0.2)'

        if (isFirst) {
          size = 18
          bgColor = '#10b981'
          borderWidth = 3
          shadow = '0 2px 6px rgba(16,185,129,0.4)'
        } else if (isLast) {
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

        el.style.cssText = `
          width: ${size}px;
          height: ${size}px;
          background: ${bgColor};
          border: ${borderWidth}px solid ${borderColor};
          border-radius: 50%;
          box-shadow: ${shadow};
          cursor: pointer;
          position: relative;
        `

        // Time label for stops with estimated minutes
        if (stop.estimatedMinutes != null || isStudent) {
          const label = document.createElement('div')
          const timeText = stop.estimatedMinutes != null
            ? `${stop.estimatedMinutes} min`
            : (eta || '')
          label.className = 'stop-time-label'
          label.style.cssText = `
            position: absolute;
            top: ${size + 4}px;
            left: 50%;
            transform: translateX(-50%);
            background: #1a1a2e;
            color: white;
            font-size: 9px;
            font-weight: 800;
            padding: 2px 6px;
            border-radius: 6px;
            white-space: nowrap;
            font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
            letter-spacing: 0.3px;
            box-shadow: 0 1px 4px rgba(0,0,0,0.2);
            pointer-events: none;
          `
          label.textContent = timeText
          el.appendChild(label)
        }

        // Stop name tooltip on hover
        const nameEl = document.createElement('div')
        nameEl.style.cssText = `
          position: absolute;
          bottom: ${size + 4}px;
          left: 50%;
          transform: translateX(-50%);
          background: ${isDark ? '#374151' : '#ffffff'};
          color: ${isDark ? '#f3f4f6' : '#111827'};
          font-size: 10px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 6px;
          white-space: nowrap;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          opacity: 0;
          transition: opacity 0.2s;
          pointer-events: none;
        `
        nameEl.textContent = stop.name
        el.appendChild(nameEl)

        el.addEventListener('mouseenter', () => { nameEl.style.opacity = '1' })
        el.addEventListener('mouseleave', () => { nameEl.style.opacity = '0' })

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([stop.lng, stop.lat])
          .addTo(map)

        markersRef.current.push(marker)
      })
    }

    if (map.isStyleLoaded()) {
      updateStops()
    } else {
      map.once('style.load', updateStops)
    }
  }, [stops, studentStop, eta, isDark])

  // ─── Bus Marker with Smooth Animation ────────────────────────────────────

  // Create/update the live bus marker
  useEffect(() => {
    const map = mapRef.current
    if (!map || !initializedRef.current) return

    const updateBusMarker = () => {
      if (!showLiveBus || !displayPosition) return

      // Remove old bus markers (first 1 or fleet markers are separate)
      // We track the main bus marker separately
      const existingBusMarker = markersRef.current.find(
        m => m.getElement()?.classList.contains('bus-marker-main')
      )

      const el = existingBusMarker?.getElement() || createBusMarkerElement(busLocation?.heading ?? 0, busLocation?.speed, true, '#10b981')
      el.classList.add('bus-marker-main')

      if (!existingBusMarker) {
        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([displayPosition.lng, displayPosition.lat])
          .addTo(map)
        markersRef.current.push(marker)
        markerPosRef.current = { lat: displayPosition.lat, lng: displayPosition.lng }
        prevBusPosRef.current = { lat: displayPosition.lat, lng: displayPosition.lng }
      } else {
        // Smooth animation to new position
        const prevPos = prevBusPosRef.current || markerPosRef.current
        const newPos = { lat: displayPosition.lat, lng: displayPosition.lng }

        // Update heading rotation
        const innerEl = el.querySelector('.bus-icon-inner') as HTMLElement
        if (innerEl && busLocation?.heading != null) {
          innerEl.style.transform = `rotate(${busLocation.heading}deg)`
        }

        // Update speed badge
        const speedEl = el.querySelector('.bus-speed-badge') as HTMLElement
        if (speedEl && busLocation?.speed != null) {
          speedEl.textContent = `${Math.round(busLocation.speed)}`
        }

        if (prevPos) {
          const dist = Math.sqrt(
            Math.pow(newPos.lat - prevPos.lat, 2) +
            Math.pow(newPos.lng - prevPos.lng, 2)
          )

          // Cancel existing animation
          if (animFrameRef.current) {
            cancelAnimationFrame(animFrameRef.current)
          }

          if (dist < 0.00003) {
            // Tiny movement, just snap
            existingBusMarker.setLngLat([newPos.lng, newPos.lat])
            markerPosRef.current = newPos
            prevBusPosRef.current = newPos
            return
          }

          // Smooth animation with easing
          const duration = Math.min(Math.max(600, dist * 400000), 2500)
          const startTime = performance.now()
          const startLat = prevPos.lat
          const startLng = prevPos.lng
          const deltaLat = newPos.lat - startLat
          const deltaLng = newPos.lng - startLng

          const animate = (now: number) => {
            const t = Math.min((now - startTime) / duration, 1)
            // Ease-out quintic - buttery Uber feel
            const eased = 1 - Math.pow(1 - t, 5)
            const currentLat = startLat + deltaLat * eased
            const currentLng = startLng + deltaLng * eased

            existingBusMarker.setLngLat([currentLng, currentLat])
            markerPosRef.current = { lat: currentLat, lng: currentLng }

            if (t < 1) {
              animFrameRef.current = requestAnimationFrame(animate)
            } else {
              prevBusPosRef.current = newPos
              animFrameRef.current = 0
            }
          }

          animFrameRef.current = requestAnimationFrame(animate)
        } else {
          existingBusMarker.setLngLat([displayPosition.lng, displayPosition.lat])
          markerPosRef.current = { lat: displayPosition.lat, lng: displayPosition.lng }
          prevBusPosRef.current = { lat: displayPosition.lat, lng: displayPosition.lng }
        }
      }
    }

    if (map.isStyleLoaded()) {
      updateBusMarker()
    } else {
      map.once('style.load', updateBusMarker)
    }

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [displayPosition, showLiveBus, busLocation, isDark])

  // ─── Fleet Bus Markers ────────────────────────────────────────────────────

  useEffect(() => {
    const map = mapRef.current
    if (!map || !initializedRef.current || !fleetBuses || fleetBuses.length === 0) return

    const updateFleet = () => {
      // Remove fleet markers (those with fleet-marker class)
      markersRef.current = markersRef.current.filter(m => {
        if (m.getElement()?.classList.contains('fleet-marker')) {
          m.remove()
          return false
        }
        return true
      })

      fleetBuses.forEach(fb => {
        const el = createBusMarkerElement(
          fb.heading ?? 0,
          fb.speed,
          fb.isLive,
          fb.color ?? '#10b981'
        )
        el.classList.add('fleet-marker')

        // Add name label
        if (fb.busName) {
          const label = document.createElement('div')
          label.style.cssText = `
            position: absolute;
            top: calc(100% + 3px);
            left: 50%;
            transform: translateX(-50%);
            background: #1a1a2e;
            color: white;
            font-size: 10px;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 8px;
            white-space: nowrap;
            box-shadow: 0 2px 8px rgba(0,0,0,0.25);
            pointer-events: none;
          `
          label.textContent = fb.busName
          el.appendChild(label)
        }

        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([fb.lng, fb.lat])
          .addTo(map)
        markersRef.current.push(marker)
      })
    }

    if (map.isStyleLoaded()) {
      updateFleet()
    } else {
      map.once('style.load', updateFleet)
    }
  }, [fleetBuses, isDark])

  // ─── Camera Follow ────────────────────────────────────────────────────────

  useEffect(() => {
    const map = mapRef.current
    if (!map || !followBus || !displayPosition) return

    map.easeTo({
      center: [displayPosition.lng, displayPosition.lat],
      duration: 1200,
      easing: (t) => 1 - Math.pow(1 - t, 3), // ease-out cubic
    })
  }, [followBus, displayPosition])

  // ─── Fit Bounds on Initial Load ───────────────────────────────────────────

  const hasFittedRef = useRef(false)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !initializedRef.current || hasFittedRef.current) return

    const points: [number, number][] = [] // [lng, lat]
    if (routePath && routePath.length > 0) {
      routePath.forEach(([lat, lng]) => points.push([lng, lat]))
    }
    if (stops && stops.length > 0) {
      stops.forEach(s => points.push([s.lng, s.lat]))
    }
    if (displayPosition) {
      points.push([displayPosition.lng, displayPosition.lat])
    }
    if (fleetBuses && fleetBuses.length > 0) {
      fleetBuses.forEach(fb => points.push([fb.lng, fb.lat]))
    }

    if (points.length > 0) {
      const bounds = new maplibregl.LngLatBounds()
      points.forEach(p => bounds.extend(p as [number, number]))

      map.fitBounds(bounds, {
        padding: { top: 50, bottom: 50, left: 50, right: 50 },
        maxZoom: 15,
        duration: 1000,
      })
      hasFittedRef.current = true
    }
  }, [routePath, stops, displayPosition, fleetBuses])

  // ─── Trail Line ───────────────────────────────────────────────────────────

  const trailGeoJSON = useMemo(() => {
    if (!trail || trail.length < 2) return null
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: trail.map(t => [t.lng, t.lat]),
      },
    }
  }, [trail])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !initializedRef.current) return

    const updateTrail = () => {
      if (map.getLayer('trail-line')) map.removeLayer('trail-line')
      if (map.getSource('trail-source')) map.removeSource('trail-source')

      if (trailGeoJSON) {
        map.addSource('trail-source', {
          type: 'geojson',
          data: trailGeoJSON,
        })
        map.addLayer({
          id: 'trail-line',
          type: 'line',
          source: 'trail-source',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#10b981',
            'line-width': 3,
            'line-opacity': 0.25,
          },
        })
      }
    }

    if (map.isStyleLoaded()) {
      updateTrail()
    } else {
      map.once('style.load', updateTrail)
    }
  }, [trailGeoJSON, isDark])

  return (
    <div className={`h-full w-full rounded-2xl overflow-hidden ${className ?? ''}`} style={{ minHeight: 250 }}>
      <div ref={mapContainerRef} className="h-full w-full" style={{ minHeight: 250 }} />
    </div>
  )
}

// ─── Bus Marker Element Factory ──────────────────────────────────────────────

function createBusMarkerElement(
  heading: number,
  speed?: number,
  isLive: boolean = true,
  color: string = '#10b981'
): HTMLDivElement {
  const el = document.createElement('div')
  el.style.cssText = `
    position: relative;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  `

  // Parse color for rgba
  const hex = color.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  // Pulse rings for live buses
  if (isLive) {
    const pulse1 = document.createElement('div')
    pulse1.style.cssText = `
      position: absolute;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: rgba(${r},${g},${b},0.2);
      animation: uberPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
    `
    el.appendChild(pulse1)

    const pulse2 = document.createElement('div')
    pulse2.style.cssText = `
      position: absolute;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: rgba(${r},${g},${b},0.2);
      animation: uberPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite 0.6s;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
    `
    el.appendChild(pulse2)
  }

  // Main bus icon circle
  const icon = document.createElement('div')
  icon.className = 'bus-icon-inner'
  icon.style.cssText = `
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: ${color};
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 3px 14px rgba(${r},${g},${b},0.4), 0 0 0 3px rgba(255,255,255,0.95);
    transform: rotate(${heading}deg);
    border: 3px solid white;
    transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
    position: relative;
    z-index: 2;
  `

  // Bus SVG icon
  icon.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="none">
      <rect x="4" y="3" width="16" height="14" rx="3" fill="white"/>
      <rect x="6" y="5" width="5" height="5" rx="1" fill="${color}" opacity="0.3"/>
      <rect x="13" y="5" width="5" height="5" rx="1" fill="${color}" opacity="0.3"/>
      <rect x="6" y="12" width="12" height="3" rx="1" fill="${color}" opacity="0.15"/>
      <circle cx="8" cy="19" r="2" fill="white"/>
      <circle cx="16" cy="19" r="2" fill="white"/>
      <rect x="3" y="8" width="2" height="4" rx="1" fill="white" opacity="0.8"/>
      <rect x="19" y="8" width="2" height="4" rx="1" fill="white" opacity="0.8"/>
    </svg>
  `
  el.appendChild(icon)

  // Speed badge
  if (speed != null && speed > 0) {
    const badge = document.createElement('div')
    badge.className = 'bus-speed-badge'
    badge.style.cssText = `
      position: absolute;
      top: -6px;
      right: -6px;
      background: #1a1a2e;
      color: white;
      font-size: 9px;
      font-weight: 800;
      padding: 2px 5px;
      border-radius: 8px;
      white-space: nowrap;
      font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
      box-shadow: 0 1px 4px rgba(0,0,0,0.3);
      letter-spacing: 0.3px;
      z-index: 3;
    `
    badge.textContent = `${Math.round(speed)}`
    const unit = document.createElement('span')
    unit.style.cssText = 'font-size:7px;font-weight:600;opacity:0.8'
    unit.textContent = 'km/h'
    badge.appendChild(unit)
    el.appendChild(badge)
  }

  // Live indicator dot
  if (isLive) {
    const liveDot = document.createElement('div')
    liveDot.style.cssText = `
      position: absolute;
      top: -3px;
      left: -3px;
      width: 10px;
      height: 10px;
      background: #ef4444;
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 0 4px rgba(239,68,68,0.6);
      animation: livePulse 1.5s ease-in-out infinite;
      z-index: 3;
    `
    el.appendChild(liveDot)
  }

  // Inject keyframes if not already present
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
    `
    document.head.appendChild(style)
  }

  return el
}
