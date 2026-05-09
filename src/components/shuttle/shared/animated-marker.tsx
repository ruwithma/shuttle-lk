'use client'

import { useEffect, useRef, useMemo } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'

interface AnimatedMarkerProps {
  position: { lat: number; lng: number }
  heading?: number
  speed?: number
  color?: string
  label?: string
  isLive?: boolean
  showPulse?: boolean
  zIndexOffset?: number
  type?: 'bus' | 'car' // Uber uses car icon, we default to bus
}

/**
 * Uber-quality animated marker with:
 * - Smooth position interpolation (requestAnimationFrame)
 * - Heading-aware rotation with smooth transitions
 * - Pulse effect for live vehicles
 * - Speed badge
 * - Label below
 * - Live indicator dot
 */
export default function AnimatedMarker({
  position,
  heading = 0,
  speed,
  color = '#10b981',
  label,
  isLive = true,
  showPulse = true,
  zIndexOffset = 1000,
  type = 'bus',
}: AnimatedMarkerProps) {
  const map = useMap()
  const markerRef = useRef<L.Marker | null>(null)
  const prevPosRef = useRef<{ lat: number; lng: number }>(position)
  const animFrameRef = useRef<number>(0)
  const startTimeRef = useRef<number>(0)
  const durationRef = useRef<number>(1200)

  // Parse color for rgba
  const colorRgb = useMemo(() => {
    const hex = color.replace('#', '')
    return {
      r: parseInt(hex.substring(0, 2), 16),
      g: parseInt(hex.substring(2, 4), 16),
      b: parseInt(hex.substring(4, 6), 16),
    }
  }, [color])

  // Create the Uber-style vehicle icon
  const icon = useMemo(() => {
    const { r, g, b } = colorRgb
    const bgRgba20 = `rgba(${r},${g},${b},0.2)`
    const bgRgba40 = `rgba(${r},${g},${b},0.4)`

    // Pulse ring for live vehicles
    const pulseHtml = showPulse && isLive ? `
      <div style="
        position: absolute;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: ${bgRgba20};
        animation: uberPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
      "></div>
      <div style="
        position: absolute;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: ${bgRgba20};
        animation: uberPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite 0.6s;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
      "></div>
    ` : ''

    // Speed badge (top-right)
    const speedBadge = speed != null && speed > 0 ? `
      <div style="
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
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif;
        box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        letter-spacing: 0.3px;
      ">${Math.round(speed)}<span style="font-size:7px;font-weight:600;opacity:0.8">km/h</span></div>
    ` : ''

    // Label (below marker)
    const labelHtml = label ? `
      <div style="
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
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif;
        box-shadow: 0 2px 8px rgba(0,0,0,0.25);
        letter-spacing: 0.2px;
      ">${label}</div>
    ` : ''

    // Live dot (top-left)
    const liveDot = isLive ? `
      <div style="
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
      "></div>
    ` : ''

    // The bus SVG icon - styled like Uber's car icon but as a bus
    const busSvg = type === 'bus' ? `
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
    ` : `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="none">
        <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
      </svg>
    `

    const html = `
      <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
        ${pulseHtml}
        <div style="
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: ${color};
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 3px 14px ${bgRgba40}, 0 0 0 3px rgba(255,255,255,0.95);
          transform: rotate(${heading}deg);
          border: 3px solid white;
          transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
        ">
          ${busSvg}
        </div>
        ${speedBadge}
        ${labelHtml}
        ${liveDot}
        <style>
          @keyframes uberPulse {
            0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.8; }
            100% { transform: translate(-50%, -50%) scale(2.5); opacity: 0; }
          }
          @keyframes livePulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(0.85); }
          }
        </style>
      </div>
    `

    return L.divIcon({
      html,
      className: '',
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    })
  }, [heading, color, colorRgb, speed, label, isLive, showPulse, type])

  // Create marker on mount / icon change
  useEffect(() => {
    const marker = L.marker([position.lat, position.lng], {
      icon,
      zIndexOffset,
    }).addTo(map)

    markerRef.current = marker

    return () => {
      marker.remove()
      markerRef.current = null
    }
  }, [map, icon, zIndexOffset])

  // Animate position changes smoothly - Uber-quality interpolation
  useEffect(() => {
    const marker = markerRef.current
    if (!marker) return

    const prevPos = prevPosRef.current
    const newPos = position

    // Calculate distance
    const dist = Math.sqrt(
      Math.pow(newPos.lat - prevPos.lat, 2) + Math.pow(newPos.lng - prevPos.lng, 2)
    )

    // If tiny movement (<3m), just snap
    if (dist < 0.00003) {
      marker.setLatLng([newPos.lat, newPos.lng])
      prevPosRef.current = newPos
      return
    }

    // Cancel existing animation
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
    }

    // Adaptive duration: shorter for small distances, longer for big jumps
    // Uber uses ~1s for typical GPS update intervals
    const duration = Math.min(Math.max(600, dist * 400000), 2500)
    durationRef.current = duration
    startTimeRef.current = performance.now()

    const startLat = prevPos.lat
    const startLng = prevPos.lng
    const deltaLat = newPos.lat - startLat
    const deltaLng = newPos.lng - startLng

    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current
      const t = Math.min(elapsed / durationRef.current, 1)

      // Ease-out quintic for that buttery Uber feel
      const eased = 1 - Math.pow(1 - t, 5)

      const currentLat = startLat + deltaLat * eased
      const currentLng = startLng + deltaLng * eased

      marker.setLatLng([currentLat, currentLng])

      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(animate)
      } else {
        prevPosRef.current = newPos
        animFrameRef.current = 0
      }
    }

    animFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [position])

  return null
}
