import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/routes?busId=xxx - Get routes for a bus
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const busId = searchParams.get('busId')
    const routeId = searchParams.get('routeId')

    if (routeId) {
      const route = await db.route.findUnique({
        where: { id: routeId },
        include: { bus: { select: { name: true, plateNumber: true } } },
      })
      if (!route) {
        return NextResponse.json({ error: 'Route not found' }, { status: 404 })
      }
      return NextResponse.json(route, {
        headers: { 'Cache-Control': 'private, max-age=30' },
      })
    }

    if (!busId) {
      return NextResponse.json({ error: 'busId or routeId required' }, { status: 400 })
    }

    const routes = await db.route.findMany({
      where: { busId, isActive: true },
      orderBy: { recordedAt: 'desc' },
    })

    return NextResponse.json({ routes }, {
      headers: { 'Cache-Control': 'private, max-age=30' },
    })
  } catch (error) {
    console.error('Routes GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch routes' }, { status: 500 })
  }
}

// POST /api/routes - Create a new recorded route
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { busId, name, direction, coordinates, stops, totalDistance, estimatedDuration } = body

    if (!busId || !name || !coordinates || !Array.isArray(coordinates)) {
      return NextResponse.json({ error: 'busId, name, and coordinates are required' }, { status: 400 })
    }

    // Verify bus exists
    const bus = await db.bus.findUnique({ where: { id: busId } })
    if (!bus) {
      return NextResponse.json({ error: 'Bus not found' }, { status: 404 })
    }

    // Create the route
    const route = await db.route.create({
      data: {
        busId,
        name,
        direction: direction || 'forward',
        coordinates: JSON.stringify(coordinates),
        stops: JSON.stringify(stops || []),
        totalDistance: totalDistance || null,
        estimatedDuration: estimatedDuration || null,
      },
    })

    // Also update the bus's route coordinates with the latest recorded route
    // This ensures backward compatibility with existing components
    // BUG FIX: Bus.routeCoordinates convention is [lat, lng] pairs,
    // but the POST body `coordinates` is in [lng, lat] (MapLibre convention).
    // We must convert back to [lat, lng] before storing on the bus.
    const busCoordStr = JSON.stringify(
      coordinates.map((c: [number, number]) => [c[1], c[0]] as [number, number])
    )
    const stopsCoordStr = stops && stops.length > 0
      ? JSON.stringify(
          stops.reduce((acc: Record<string, [number, number]>, s: any) => {
            acc[s.name] = [s.lat, s.lng]
            return acc
          }, {})
        )
      : bus.routeStopCoordinates

    await db.bus.update({
      where: { id: busId },
      data: {
        routeCoordinates: busCoordStr,
        routeStopCoordinates: stopsCoordStr,
        routeName: name,
      },
    })

    return NextResponse.json(route, { status: 201 })
  } catch (error) {
    console.error('Routes POST error:', error)
    return NextResponse.json({ error: 'Failed to create route' }, { status: 500 })
  }
}

// DELETE /api/routes?routeId=xxx - Delete a route
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const routeId = searchParams.get('routeId')

    if (!routeId) {
      return NextResponse.json({ error: 'routeId required' }, { status: 400 })
    }

    await db.route.delete({ where: { id: routeId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Routes DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete route' }, { status: 500 })
  }
}
