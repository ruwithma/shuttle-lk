import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/shuttles - Find/search shuttles
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.toLowerCase()
    const area = searchParams.get('area')?.toLowerCase()
    const lat = searchParams.get('lat')
    const lng = searchParams.get('lng')
    const radius = parseFloat(searchParams.get('radius') || '10')

    const buses = await db.bus.findMany({
      where: { active: true },
      include: {
        driver: { select: { id: true, name: true, phone: true } },
        owner: { select: { id: true, name: true } },
        subscriptions: {
          where: { active: true },
          select: { id: true, paymentType: true, monthlyAmount: true, dailyAmount: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    let results = buses.map((bus) => {
      const stopNames = bus.routeStops ? bus.routeStops.split(',').map(s => s.trim()).filter(Boolean) : []

      let routeCoords: [number, number][] = []
      try {
        const parsed = JSON.parse(bus.routeCoordinates || '[]')
        if (Array.isArray(parsed)) routeCoords = parsed
      } catch {}

      const activeSubs = bus.subscriptions.length
      const occupancyPercent = bus.capacity > 0 ? Math.round((activeSubs / bus.capacity) * 100) : 0

      const monthlyPrices = bus.subscriptions
        .filter(s => s.paymentType === 'MONTHLY' && s.monthlyAmount)
        .map(s => s.monthlyAmount!)
      const dailyPrices = bus.subscriptions
        .filter(s => s.paymentType === 'DAILY' && s.dailyAmount)
        .map(s => s.dailyAmount!)

      const priceRange = {
        daily: dailyPrices.length > 0
          ? { min: Math.min(...dailyPrices), max: Math.max(...dailyPrices) }
          : null,
        monthly: monthlyPrices.length > 0
          ? { min: Math.min(...monthlyPrices), max: Math.max(...monthlyPrices) }
          : null,
      }

      const now = new Date()
      const LIVE_THRESHOLD_MS = 5 * 60 * 1000
      const isLive = bus.locationUpdatedAt
        ? now.getTime() - new Date(bus.locationUpdatedAt).getTime() < LIVE_THRESHOLD_MS
        : false

      return {
        id: bus.id,
        name: bus.name,
        plateNumber: bus.plateNumber,
        capacity: bus.capacity,
        routeName: bus.routeName,
        routeStart: bus.routeStart,
        routeEnd: bus.routeEnd,
        stops: stopNames,
        routeCoordinates: routeCoords,
        routeStopCoordinates: bus.routeStopCoordinates,
        currentLat: bus.currentLat,
        currentLng: bus.currentLng,
        isLive,
        driver: bus.driver,
        owner: bus.owner,
        activeSubscriptions: activeSubs,
        occupancyPercent,
        priceRange,
        seatsAvailable: Math.max(0, bus.capacity - activeSubs),
      }
    })

    if (q) {
      results = results.filter(bus =>
        bus.name.toLowerCase().includes(q) ||
        bus.routeName.toLowerCase().includes(q) ||
        bus.routeStart.toLowerCase().includes(q) ||
        bus.routeEnd.toLowerCase().includes(q) ||
        bus.stops.some(s => s.toLowerCase().includes(q))
      )
    }

    if (area) {
      results = results.filter(bus =>
        bus.routeStart.toLowerCase().includes(area) ||
        bus.routeEnd.toLowerCase().includes(area) ||
        bus.routeName.toLowerCase().includes(area) ||
        bus.stops.some(s => s.toLowerCase().includes(area))
      )
    }

    if (lat && lng) {
      const userLat = parseFloat(lat)
      const userLng = parseFloat(lng)
      const radiusMeters = radius * 1000

      results = results.filter(bus => {
        if (bus.currentLat && bus.currentLng) {
          const dist = getDistance(userLat, userLng, bus.currentLat, bus.currentLng)
          if (dist <= radiusMeters) return true
        }
        try {
          const stopCoords = JSON.parse(bus.routeStopCoordinates || '{}')
          for (const coord of Object.values(stopCoords)) {
            const c = coord as [number, number]
            const dist = getDistance(userLat, userLng, c[0], c[1])
            if (dist <= radiusMeters) return true
          }
        } catch {}
        return false
      })

      results.sort((a, b) => {
        const distA = a.currentLat && a.currentLng ? getDistance(userLat, userLng, a.currentLat, a.currentLng) : Infinity
        const distB = b.currentLat && b.currentLng ? getDistance(userLat, userLng, b.currentLat, b.currentLng) : Infinity
        return distA - distB
      })
    }

    const popularAreas = [
      'Colombo', 'Kandy', 'Galle', 'Kadawatha', 'Kiribathgoda',
      'Nugegoda', 'Maharagama', 'Battaramulla', 'Dehiwala',
      'Kelaniya', 'Wattala', 'Negombo', 'Kurunegala',
      'University of Kelaniya', 'University of Colombo',
      'University of Peradeniya', 'University of Moratuwa',
    ]

    return NextResponse.json({
      shuttles: results,
      total: results.length,
      popularAreas,
    })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.error('Search shuttles error:', error)
    return NextResponse.json(
      { error: 'Failed to search shuttles', details: String(error) },
      { status: 500 }
    )
  }
}

function getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180)
}
