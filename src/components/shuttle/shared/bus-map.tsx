'use client'

import dynamic from 'next/dynamic'

const BusMapInner = dynamic(() => import('./bus-map-inner'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-gray-100 rounded-2xl animate-pulse flex items-center justify-center" style={{ minHeight: 250 }}>
      <span className="text-sm text-muted-foreground">Loading map...</span>
    </div>
  ),
})

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
  followBus?: boolean
  showZoomControl?: boolean
}

export default function BusMap(props: BusMapProps) {
  return <BusMapInner {...props} />
}
