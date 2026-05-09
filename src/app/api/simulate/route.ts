import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/simulate - Get simulation data for a bus route
// This is a helper endpoint that returns the route coordinates for client-side simulation
// The actual simulation runs on the client via useSimulation hook
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { busId, action } = body as { busId: string; action: 'start' | 'stop' | 'status' }

    if (!busId) {
      return NextResponse.json({ error: 'busId is required' }, { status: 400 })
    }

    const bus = await db.bus.findUnique({
      where: { id: busId },
      include: {
        routes: {
          where: { isActive: true },
          orderBy: { recordedAt: 'desc' },
          take: 1,
        },
      },
    })

    if (!bus) {
      return NextResponse.json({ error: 'Bus not found' }, { status: 404 })
    }

    if (action === 'start' || action === 'status') {
      // Parse route coordinates
      let routeCoordinates: [number, number][] = []
      try {
        const coords = JSON.parse(bus.routeCoordinates || '[]')
        if (Array.isArray(coords) && coords.length > 0) {
          routeCoordinates = coords.map((c: number[]) => [c[0], c[1]] as [number, number])
        }
      } catch {}

      // Get stops from the latest route record if available
      let stops: Array<{ name: string; lat: number; lng: number; order: number; estimatedMinutes?: number }> = []
      if (bus.routes.length > 0) {
        try {
          const parsedStops = JSON.parse(bus.routes[0].stops || '[]')
          if (Array.isArray(parsedStops)) {
            stops = parsedStops
          }
        } catch {}
      }

      return NextResponse.json({
        busId: bus.id,
        busName: bus.name,
        routeName: bus.routeName,
        routeStart: bus.routeStart,
        routeEnd: bus.routeEnd,
        routeCoordinates,
        stops,
        totalPoints: routeCoordinates.length,
        plateNumber: bus.plateNumber,
        ownerId: bus.ownerId,
        driverId: bus.driverId,
        message: action === 'start'
          ? 'Use the useSimulation hook on the client to start simulation. This endpoint provides route data only.'
          : 'Simulation data retrieved',
      })
    }

    if (action === 'stop') {
      return NextResponse.json({
        busId,
        message: 'Simulation stop signal received. Client-side simulation should be stopped via useSimulation hook.',
      })
    }

    return NextResponse.json({ error: 'Invalid action. Use start, stop, or status.' }, { status: 400 })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.error('Simulate API error:', error)
    return NextResponse.json(
      { error: 'Failed to process simulation request', details: String(error) },
      { status: 500 }
    )
  }
}

// GET /api/simulate?busId=xxx - Get simulation route data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const busId = searchParams.get('busId')

    if (!busId) {
      return NextResponse.json({ error: 'busId is required' }, { status: 400 })
    }

    const bus = await db.bus.findUnique({
      where: { id: busId },
      include: {
        routes: {
          where: { isActive: true },
          orderBy: { recordedAt: 'desc' },
          take: 1,
        },
      },
    })

    if (!bus) {
      return NextResponse.json({ error: 'Bus not found' }, { status: 404 })
    }

    // Parse route coordinates
    let routeCoordinates: [number, number][] = []
    try {
      const coords = JSON.parse(bus.routeCoordinates || '[]')
      if (Array.isArray(coords) && coords.length > 0) {
        routeCoordinates = coords.map((c: number[]) => [c[0], c[1]] as [number, number])
      }
    } catch {}

    // Get stops from the latest route record if available
    let stops: Array<{ name: string; lat: number; lng: number; order: number; estimatedMinutes?: number }> = []
    if (bus.routes.length > 0) {
      try {
        const parsedStops = JSON.parse(bus.routes[0].stops || '[]')
        if (Array.isArray(parsedStops)) {
          stops = parsedStops
        }
      } catch {}
    }

    return NextResponse.json({
      busId: bus.id,
      busName: bus.name,
      routeName: bus.routeName,
      routeStart: bus.routeStart,
      routeEnd: bus.routeEnd,
      routeCoordinates,
      stops,
      totalPoints: routeCoordinates.length,
      plateNumber: bus.plateNumber,
      ownerId: bus.ownerId,
      driverId: bus.driverId,
    })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.error('Simulate GET error:', error)
    return NextResponse.json(
      { error: 'Failed to get simulation data', details: String(error) },
      { status: 500 }
    )
  }
}
