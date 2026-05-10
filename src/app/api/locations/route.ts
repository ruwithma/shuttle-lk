import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/locations - Get bus locations
// Query params: busId (single bus) or ownerId (all buses of owner) or driverId (bus assigned to driver)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const busId = searchParams.get('busId')
    const ownerId = searchParams.get('ownerId')
    const driverId = searchParams.get('driverId')

    if (!busId && !ownerId && !driverId) {
      return NextResponse.json(
        { error: 'Provide at least one of: busId, ownerId, or driverId' },
        { status: 400 }
      )
    }

    // Build the where clause for buses
    const busWhere: Record<string, unknown> = {}
    if (busId) {
      busWhere.id = busId
    } else if (ownerId) {
      busWhere.ownerId = ownerId
    } else if (driverId) {
      busWhere.driverId = driverId
    }

    // Fetch buses with their latest location
    const buses = await db.bus.findMany({
      where: busWhere,
      include: {
        locations: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
    })

    if (buses.length === 0) {
      return NextResponse.json({ locations: [], trail: [] })
    }

    // Determine if a bus is "live" (location updated within last 5 minutes)
    const now = new Date()
    const LIVE_THRESHOLD_MS = 5 * 60 * 1000

    const locations = buses.map((bus) => {
      const latestLocation = bus.locations[0]
      const isLive = bus.locationUpdatedAt
        ? now.getTime() - new Date(bus.locationUpdatedAt).getTime() < LIVE_THRESHOLD_MS
        : false

      return {
        busId: bus.id,
        busName: bus.name,
        plateNumber: bus.plateNumber,
        lat: bus.currentLat ?? latestLocation?.lat ?? null,
        lng: bus.currentLng ?? latestLocation?.lng ?? null,
        speed: latestLocation?.speed ?? null,
        heading: latestLocation?.heading ?? null,
        timestamp: latestLocation?.timestamp ?? bus.locationUpdatedAt ?? null,
        routeName: bus.routeName,
        isLive,
      }
    })

    // For single busId, also return trail (last 20 location points)
    let trail: Array<{ lat: number; lng: number; timestamp: string }> = []
    if (busId) {
      const locationHistory = await db.busLocation.findMany({
        where: { busId },
        orderBy: { timestamp: 'desc' },
        take: 20,
      })
      trail = locationHistory.map((loc) => ({
        lat: loc.lat,
        lng: loc.lng,
        timestamp: loc.timestamp.toISOString(),
      }))
      // Return in chronological order (oldest first) for trail drawing
      trail.reverse()
    }

    return NextResponse.json({ locations, trail }, {
      headers: { 'Cache-Control': 'private, max-age=5' },
    })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.error('Get locations error:', error)
    return NextResponse.json(
      { error: 'Failed to get locations', details: String(error) },
      { status: 500 }
    )
  }
}

// POST /api/locations - Update bus location
// Body: { busId, lat, lng, speed?, heading?, driverId }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { busId, lat, lng, speed, heading, driverId } = body

    if (!busId || lat === undefined || lng === undefined) {
      return NextResponse.json(
        { error: 'busId, lat, and lng are required' },
        { status: 400 }
      )
    }

    // Verify bus exists and optionally check driver assignment
    const bus = await db.bus.findUnique({
      where: { id: busId },
    })

    if (!bus) {
      return NextResponse.json({ error: 'Bus not found' }, { status: 404 })
    }

    // If driverId provided, verify the driver is assigned to this bus
    if (driverId && bus.driverId !== driverId) {
      return NextResponse.json(
        { error: 'Driver is not assigned to this bus' },
        { status: 403 }
      )
    }

    // Create BusLocation record and update Bus current position in a transaction
    const [location] = await db.$transaction([
      db.busLocation.create({
        data: {
          busId,
          lat: parseFloat(String(lat)),
          lng: parseFloat(String(lng)),
          speed: speed != null ? parseFloat(String(speed)) : null,
          heading: heading != null ? parseFloat(String(heading)) : null,
        },
      }),
      db.bus.update({
        where: { id: busId },
        data: {
          currentLat: parseFloat(String(lat)),
          currentLng: parseFloat(String(lng)),
          locationUpdatedAt: new Date(),
        },
      }),
    ])

    return NextResponse.json({ location }, { status: 201 })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.error('Create location error:', error)
    return NextResponse.json(
      { error: 'Failed to create location', details: String(error) },
      { status: 500 }
    )
  }
}
