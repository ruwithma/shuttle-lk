'use client'

import { useEffect, useRef, useCallback, useMemo, useState } from 'react'
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

// ─── Marker Tracking Types ───────────────────────────────────────────────────

type MarkerType = 'stop' | 'bus-main' | 'fleet'

interface TrackedMarker {
  marker: maplibregl.Marker
  type: MarkerType
  key: string // unique identifier for the marker
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
  const trackedMarkersRef = useRef<TrackedMarker[]>([])
  const prevBusPosRef = useRef<{ lat: number; lng: number } | null>(null)
  const animFrameRef = useRef<number>(0)
  const markerPosRef = useRef<{ lat: number; lng: number } | null>(null)
  const isStyleChangingRef = useRef(false) // Guard against redundant layer updates during style change

  // FIX: Use React state (not just a ref) so that effects re-run when map becomes ready.
  // Previously, initializedRef was set in map 'load' callback, but effects checking it
  // wouldn't re-run because ref changes don't trigger re-renders.
  const [mapReady, setMapReady] = useState(false)

  const displayPosition = interpolatedPosition || busLocation

  // ─── Refs for accessing latest values in effects without triggering re-runs ───
  const isDarkRef = useRef(isDark)
  const routeGeoJSONRef = useRef<{ type: 'Feature'; properties: Record<string, unknown>; geometry: { type: 'LineString'; coordinates: [number, number][] } } | null>(null)
  const traveledGeoJSONRef = useRef<{ type: 'Feature'; properties: Record<string, unknown>; geometry: { type: 'LineString'; coordinates: [number, number][] } } | null>(null)
  const trailGeoJSONRef = useRef<{ type: 'Feature'; properties: Record<string, unknown>; geometry: { type: 'LineString'; coordinates: [number, number][] } } | null>(null)
  const displayPositionRef = useRef(displayPosition)

  // ─── Helper: Remove markers by type ──────────────────────────────────────

  const removeMarkersByType = useCallback((type: MarkerType) => {
    const toRemove = trackedMarkersRef.current.filter(tm => tm.type === type)
    toRemove.forEach(tm => tm.marker.remove())
    trackedMarkersRef.current = trackedMarkersRef.current.filter(tm => tm.type !== type)
  }, [])

  const removeMarkersByKey = useCallback((key: string) => {
    const toRemove = trackedMarkersRef.current.filter(tm => tm.key === key)
    toRemove.forEach(tm => tm.marker.remove())
    trackedMarkersRef.current = trackedMarkersRef.current.filter(tm => tm.key !== key)
  }, [])

  // ─── Helper: Add all layers/sources to map ───────────────────────────────
  // This is called on initial load AND after style changes (dark/light toggle)

  const addAllLayersToMap = useCallback((
    map: maplibregl.Map,
    routeGeoJSON: { type: 'Feature'; properties: Record<string, unknown>; geometry: { type: 'LineString'; coordinates: [number, number][] } } | null,
    traveledGeoJSON: { type: 'Feature'; properties: Record<string, unknown>; geometry: { type: 'LineString'; coordinates: [number, number][] } } | null,
    trailGeoJSON: { type: 'Feature'; properties: Record<string, unknown>; geometry: { type: 'LineString'; coordinates: [number, number][] } } | null,
    hasBus: boolean,
  ) => {
    // Remove existing layers/sources (safe to call even if they don't exist)
    const layerIds = ['route-glow', 'route-line', 'route-traveled-glow', 'route-traveled', 'route-dash', 'trail-line']
    const sourceIds = ['route-source', 'route-traveled-source', 'trail-source']
    layerIds.forEach(id => { try { if (map.getLayer(id)) map.removeLayer(id) } catch {} })
    sourceIds.forEach(id => { try { if (map.getSource(id)) map.removeSource(id) } catch {} })

    // Route line
    if (routeGeoJSON) {
      map.addSource('route-source', { type: 'geojson', data: routeGeoJSON })

      map.addLayer({
        id: 'route-glow',
        type: 'line',
        source: 'route-source',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#10b981',
          'line-width': 12,
          'line-opacity': 0.15,
          'line-blur': 6,
        },
      })

      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route-source',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#10b981',
          'line-width': 4,
          'line-opacity': 0.4,
          'line-dasharray': [0, 4, 3],
        },
      })

      // If no bus position, show solid route
      if (!hasBus) {
        map.addLayer({
          id: 'route-dash',
          type: 'line',
          source: 'route-source',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#10b981',
            'line-width': 4,
            'line-opacity': 0.9,
          },
        })
      }
    }

    // Traveled portion
    if (traveledGeoJSON) {
      map.addSource('route-traveled-source', { type: 'geojson', data: traveledGeoJSON })

      map.addLayer({
        id: 'route-traveled-glow',
        type: 'line',
        source: 'route-traveled-source',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#10b981',
          'line-width': 10,
          'line-opacity': 0.25,
          'line-blur': 4,
        },
      })

      map.addLayer({
        id: 'route-traveled',
        type: 'line',
        source: 'route-traveled-source',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#10b981',
          'line-width': 5,
          'line-opacity': 1,
        },
      })
    }

    // Trail
    if (trailGeoJSON) {
      map.addSource('trail-source', { type: 'geojson', data: trailGeoJSON })
      map.addLayer({
        id: 'trail-line',
        type: 'line',
        source: 'trail-source',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#10b981',
          'line-width': 3,
          'line-opacity': 0.25,
        },
      })
    }
  }, [])

  // ─── Memoized GeoJSON ─────────────────────────────────────────────────────

  const routeGeoJSON = useMemo(() => {
    if (!routePath || routePath.length < 2) return null
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: routePath.map(([lat, lng]) => [lng, lat]),
      },
    }
  }, [routePath])

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

  // Keep refs in sync with memoized values (must be after useMemo declarations)
  useEffect(() => {
    isDarkRef.current = isDark
    displayPositionRef.current = displayPosition
    routeGeoJSONRef.current = routeGeoJSON
    traveledGeoJSONRef.current = traveledGeoJSON
    trailGeoJSONRef.current = trailGeoJSON
  })

  // ─── Initialize map ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: isDark ? DARK_STYLE : LIGHT_STYLE,
      center: [center[1], center[0]],
      zoom: zoom,
      attributionControl: false,
      navigationControl: false,
    })

    if (showZoomControl) {
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    }

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')

    map.on('load', () => {
      setMapReady(true) // Trigger re-render so dependent effects can add layers/markers
    })

    if (onMapClick) {
      map.on('click', (e) => {
        onMapClick(e.lngLat.lat, e.lngLat.lng)
      })
    }

    mapRef.current = map

    return () => {
      trackedMarkersRef.current.forEach(tm => tm.marker.remove())
      trackedMarkersRef.current = []
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
      map.remove()
      mapRef.current = null
      setMapReady(false)
    }
  }, []) // Only init once

  // ─── Update map style on theme change ─────────────────────────────────────
  // FIX: Only depend on isDark. Use refs for current data to avoid re-triggering
  // on every bus location update (which was causing map flickering).

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const currentCenter = map.getCenter()
    const currentZoom = map.getZoom()

    isStyleChangingRef.current = true

    map.setStyle(isDark ? DARK_STYLE : LIGHT_STYLE)

    map.once('style.load', () => {
      map.setCenter(currentCenter)
      map.setZoom(currentZoom)

      // Use refs for current data (avoids stale closures while keeping dep array minimal)
      addAllLayersToMap(
        map,
        routeGeoJSONRef.current,
        traveledGeoJSONRef.current,
        trailGeoJSONRef.current,
        !!displayPositionRef.current
      )

      // Re-add all markers
      trackedMarkersRef.current.forEach(tm => {
        try {
          tm.marker.addTo(map)
        } catch {
          // Marker may already be on map
        }
      })

      isStyleChangingRef.current = false
    })
  }, [isDark, mapReady]) // mapReady ensures we don't try to change style before map loads

  // ─── Update route GeoJSON data (efficient setData) ────────────────────────
  // FIX: Use source.setData() instead of removing/re-adding layers on every update

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || isStyleChangingRef.current) return

    const updateData = () => {
      const hasBus = !!displayPosition

      // --- Route source ---
      const routeSource = map.getSource('route-source') as maplibregl.GeoJSONSource | undefined
      if (routeSource && routeGeoJSON) {
        // Update existing source data (no flicker)
        routeSource.setData(routeGeoJSON)

        // Handle route-dash layer visibility
        try {
          const hasDashLayer = !!map.getLayer('route-dash')
          if (hasBus && hasDashLayer) {
            map.removeLayer('route-dash')
          } else if (!hasBus && !hasDashLayer) {
            map.addLayer({
              id: 'route-dash',
              type: 'line',
              source: 'route-source',
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: {
                'line-color': '#10b981',
                'line-width': 4,
                'line-opacity': 0.9,
              },
            })
          }
        } catch {}
      } else if (!routeSource && routeGeoJSON) {
        // Source doesn't exist yet — add all layers
        addAllLayersToMap(map, routeGeoJSON, traveledGeoJSON, trailGeoJSON, hasBus)
        return // All data set up in one call
      } else if (routeSource && !routeGeoJSON) {
        // Remove route layers if no data
        try { if (map.getLayer('route-glow')) map.removeLayer('route-glow') } catch {}
        try { if (map.getLayer('route-line')) map.removeLayer('route-line') } catch {}
        try { if (map.getLayer('route-dash')) map.removeLayer('route-dash') } catch {}
        try { map.removeSource('route-source') } catch {}
      }

      // --- Traveled source ---
      const traveledSource = map.getSource('route-traveled-source') as maplibregl.GeoJSONSource | undefined
      if (traveledSource && traveledGeoJSON) {
        traveledSource.setData(traveledGeoJSON)
      } else if (!traveledSource && traveledGeoJSON) {
        // Need to add traveled layers
        map.addSource('route-traveled-source', { type: 'geojson', data: traveledGeoJSON })
        map.addLayer({
          id: 'route-traveled-glow',
          type: 'line',
          source: 'route-traveled-source',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#10b981', 'line-width': 10, 'line-opacity': 0.25, 'line-blur': 4 },
        })
        map.addLayer({
          id: 'route-traveled',
          type: 'line',
          source: 'route-traveled-source',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#10b981', 'line-width': 5, 'line-opacity': 1 },
        })
      } else if (traveledSource && !traveledGeoJSON) {
        try { if (map.getLayer('route-traveled-glow')) map.removeLayer('route-traveled-glow') } catch {}
        try { if (map.getLayer('route-traveled')) map.removeLayer('route-traveled') } catch {}
        try { map.removeSource('route-traveled-source') } catch {}
      }

      // --- Trail source ---
      const trailSource = map.getSource('trail-source') as maplibregl.GeoJSONSource | undefined
      if (trailSource && trailGeoJSON) {
        trailSource.setData(trailGeoJSON)
      } else if (!trailSource && trailGeoJSON) {
        map.addSource('trail-source', { type: 'geojson', data: trailGeoJSON })
        map.addLayer({
          id: 'trail-line',
          type: 'line',
          source: 'trail-source',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#10b981', 'line-width': 3, 'line-opacity': 0.25 },
        })
      } else if (trailSource && !trailGeoJSON) {
        try { if (map.getLayer('trail-line')) map.removeLayer('trail-line') } catch {}
        try { map.removeSource('trail-source') } catch {}
      }
    }

    if (map.isStyleLoaded()) {
      updateData()
    } else {
      map.once('style.load', updateData)
    }
  }, [routeGeoJSON, traveledGeoJSON, trailGeoJSON, displayPosition, addAllLayersToMap, mapReady])

  // ─── Stop Markers ─────────────────────────────────────────────────────────

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || isStyleChangingRef.current) return

    const updateStops = () => {
      // Only remove stop markers
      removeMarkersByType('stop')

      if (!stops || stops.length === 0) return

      stops.forEach((stop, index) => {
        const isStudent = studentStop && stop.name === studentStop.name
        const isFirst = index === 0
        const isLast = index === stops.length - 1

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

        // Time label
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
            background: ${isDarkRef.current ? '#1f2937' : '#111827'};
            color: white;
            font-size: 9px;
            font-weight: 800;
            padding: 2px 6px;
            border-radius: 6px;
            white-space: nowrap;
            font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
            letter-spacing: 0.3px;
            box-shadow: 0 1px 4px rgba(0,0,0,0.3);
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
          background: ${isDarkRef.current ? '#374151' : '#ffffff'};
          color: ${isDarkRef.current ? '#f3f4f6' : '#111827'};
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

        trackedMarkersRef.current.push({
          marker,
          type: 'stop',
          key: `stop-${index}-${stop.name}`,
        })
      })
    }

    if (map.isStyleLoaded()) {
      updateStops()
    } else {
      map.once('style.load', updateStops)
    }
  }, [stops, studentStop, eta, isDark, removeMarkersByType, mapReady])

  // ─── Bus Marker with Smooth Animation ─────────────────────────────────────

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || isStyleChangingRef.current) return

    const updateBusMarker = () => {
      if (!showLiveBus || !displayPosition) {
        // Remove bus marker if not showing
        removeMarkersByKey('bus-main')
        return
      }

      const existingTm = trackedMarkersRef.current.find(
        tm => tm.key === 'bus-main'
      )
      const existingBusMarker = existingTm?.marker

      const el = existingBusMarker?.getElement() || createBusMarkerElement(busLocation?.heading ?? 0, busLocation?.speed, true, '#10b981')
      el.classList.add('bus-marker-main')

      if (!existingBusMarker) {
        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([displayPosition.lng, displayPosition.lat])
          .addTo(map)
        trackedMarkersRef.current.push({
          marker,
          type: 'bus-main',
          key: 'bus-main',
        })
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

          if (animFrameRef.current) {
            cancelAnimationFrame(animFrameRef.current)
          }

          if (dist < 0.00003) {
            existingBusMarker.setLngLat([newPos.lng, newPos.lat])
            markerPosRef.current = newPos
            prevBusPosRef.current = newPos
            return
          }

          const duration = Math.min(Math.max(600, dist * 400000), 2500)
          const startTime = performance.now()
          const startLat = prevPos.lat
          const startLng = prevPos.lng
          const deltaLat = newPos.lat - startLat
          const deltaLng = newPos.lng - startLng

          const animate = (now: number) => {
            const t = Math.min((now - startTime) / duration, 1)
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
  }, [displayPosition, showLiveBus, busLocation, isDark, removeMarkersByKey, mapReady])

  // ─── Fleet Bus Markers ────────────────────────────────────────────────────
  // FIX: Update existing marker positions instead of removing/re-creating all

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || isStyleChangingRef.current) return

    const updateFleet = () => {
      if (!fleetBuses || fleetBuses.length === 0) {
        // Remove all fleet markers if no buses
        removeMarkersByType('fleet')
        return
      }

      // Build a set of current fleet bus IDs
      const currentBusIds = new Set(fleetBuses.map(fb => fb.busId))

      // Remove markers for buses that are no longer in the fleet list
      const toRemove = trackedMarkersRef.current.filter(
        tm => tm.type === 'fleet' && !currentBusIds.has(tm.key.replace('fleet-', ''))
      )
      toRemove.forEach(tm => tm.marker.remove())
      trackedMarkersRef.current = trackedMarkersRef.current.filter(
        tm => tm.type !== 'fleet' || currentBusIds.has(tm.key.replace('fleet-', ''))
      )

      // Update or create markers for each fleet bus
      fleetBuses.forEach(fb => {
        const markerKey = `fleet-${fb.busId}`
        const existingTm = trackedMarkersRef.current.find(tm => tm.key === markerKey)

        if (existingTm) {
          // Update existing marker position
          existingTm.marker.setLngLat([fb.lng, fb.lat])
          
          // Update heading and speed on the existing element
          const innerEl = existingTm.marker.getElement().querySelector('.bus-icon-inner') as HTMLElement
          if (innerEl) {
            innerEl.style.transform = `rotate(${fb.heading ?? 0}deg)`
          }
          const speedEl = existingTm.marker.getElement().querySelector('.bus-speed-badge') as HTMLElement
          if (speedEl && fb.speed != null) {
            speedEl.textContent = `${Math.round(fb.speed)}`
          }
        } else {
          // Create new marker
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
              background: ${isDarkRef.current ? '#1f2937' : '#111827'};
              color: white;
              font-size: 10px;
              font-weight: 700;
              padding: 2px 8px;
              border-radius: 8px;
              white-space: nowrap;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
              pointer-events: none;
            `
            label.textContent = fb.busName
            el.appendChild(label)
          }

          const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
            .setLngLat([fb.lng, fb.lat])
            .addTo(map)
          trackedMarkersRef.current.push({
            marker,
            type: 'fleet',
            key: markerKey,
          })
        }
      })
    }

    if (map.isStyleLoaded()) {
      updateFleet()
    } else {
      map.once('style.load', updateFleet)
    }
  }, [fleetBuses, isDark, removeMarkersByType, mapReady])

  // ─── Camera Follow ────────────────────────────────────────────────────────

  useEffect(() => {
    const map = mapRef.current
    if (!map || !followBus || !displayPosition) return

    map.easeTo({
      center: [displayPosition.lng, displayPosition.lat],
      duration: 1200,
      easing: (t) => 1 - Math.pow(1 - t, 3),
    })
  }, [followBus, displayPosition])

  // ─── Fit Bounds ───────────────────────────────────────────────────────────

  const lastFitDataRef = useRef<string>('')

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

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

    if (points.length === 0) return

    // Create a fingerprint of the data to avoid re-fitting with same data
    const fingerprint = `${routePath?.length ?? 0}-${stops?.length ?? 0}-${fleetBuses?.length ?? 0}-${!!displayPosition}`

    if (fingerprint === lastFitDataRef.current) return

    lastFitDataRef.current = fingerprint

    const bounds = new maplibregl.LngLatBounds()
    points.forEach(p => bounds.extend(p as [number, number]))

    map.fitBounds(bounds, {
      padding: { top: 50, bottom: 50, left: 50, right: 50 },
      maxZoom: 15,
      duration: 1000,
    })
  }, [routePath, stops, displayPosition, fleetBuses, mapReady])

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
