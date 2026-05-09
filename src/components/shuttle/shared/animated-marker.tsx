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
}

// Smooth animated marker that interpolates between positions
export default function AnimatedMarker({
  position,
  heading = 0,
  speed,
  color = '#10b981',
  label,
  isLive = true,
  showPulse = true,
  zIndexOffset = 1000,
}: AnimatedMarkerProps) {
  const map = useMap()
  const markerRef = useRef<L.Marker | null>(null)
  const prevPosRef = useRef<{ lat: number; lng: number }>(position)
  const animFrameRef = useRef<number>(0)
  const startTimeRef = useRef<number>(0)
  const durationRef = useRef<number>(1500) // Animation duration in ms

  // Create the animated bus icon
  const icon = useMemo(() => {
    const bgColor = color
    const bgRgba = `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0.2)`
    const shadowRgba = `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0.4)`

    const pulseHtml = showPulse && isLive ? `
      <div style="
        position: absolute;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: ${bgRgba};
        animation: busPulse 2s ease-out infinite;
      "></div>
    ` : ''

    const speedBadge = speed != null && speed > 0 ? `
      <div style="
        position: absolute;
        top: -8px;
        right: -8px;
        background: #1f2937;
        color: white;
        font-size: 8px;
        font-weight: 700;
        padding: 1px 4px;
        border-radius: 6px;
        white-space: nowrap;
        font-family: system-ui, -apple-system, sans-serif;
      ">${Math.round(speed)}</div>
    ` : ''

    const labelHtml = label ? `
      <div style="
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        margin-top: 4px;
        background: #1f2937;
        color: white;
        font-size: 9px;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 6px;
        white-space: nowrap;
        font-family: system-ui, -apple-system, sans-serif;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      ">${label}</div>
    ` : ''

    const liveDot = isLive ? `
      <div style="
        position: absolute;
        top: -2px;
        left: -2px;
        width: 8px;
        height: 8px;
        background: #ef4444;
        border-radius: 50%;
        border: 1.5px solid white;
        animation: liveDot 1.5s ease-in-out infinite;
      "></div>
    ` : ''

    const html = `
      <div style="position: relative; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
        ${pulseHtml}
        <div style="
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: ${bgColor};
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 10px ${shadowRgba}, 0 0 0 3px rgba(255,255,255,0.9);
          transform: rotate(${heading}deg);
          border: 2.5px solid white;
          transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
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
        ${speedBadge}
        ${labelHtml}
        ${liveDot}
        <style>
          @keyframes busPulse {
            0% { transform: scale(0.8); opacity: 0.8; }
            100% { transform: scale(2.2); opacity: 0; }
          }
          @keyframes liveDot {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
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
  }, [heading, color, speed, label, isLive, showPulse])

  // Create marker on mount
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
    // Only re-create marker when icon changes
  }, [map, icon, zIndexOffset])

  // Animate position changes smoothly
  useEffect(() => {
    const marker = markerRef.current
    if (!marker) return

    const prevPos = prevPosRef.current
    const newPos = position

    // Calculate distance for animation duration
    const dist = Math.sqrt(
      Math.pow(newPos.lat - prevPos.lat, 2) + Math.pow(newPos.lng - prevPos.lng, 2)
    )

    // If distance is very small (<5m), just jump
    if (dist < 0.00005) {
      marker.setLatLng([newPos.lat, newPos.lng])
      prevPosRef.current = newPos
      return
    }

    // Cancel any existing animation
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
    }

    // Animation duration scales with distance (min 800ms, max 3000ms)
    const duration = Math.min(Math.max(800, dist * 500000), 3000)
    durationRef.current = duration
    startTimeRef.current = performance.now()

    const startLat = prevPos.lat
    const startLng = prevPos.lng
    const deltaLat = newPos.lat - startLat
    const deltaLng = newPos.lng - startLng

    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current
      const t = Math.min(elapsed / durationRef.current, 1)

      // Ease-out cubic for smooth deceleration
      const eased = 1 - Math.pow(1 - t, 3)

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
