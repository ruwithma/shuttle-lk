import { NextRequest, NextResponse } from 'next/server'
import { getRoadRoute, simplifyRoute } from '@/lib/osrm-routing'

// POST /api/routing - Get road-following route between waypoints
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { waypoints } = body // Array of [lat, lng] pairs

    if (!waypoints || !Array.isArray(waypoints) || waypoints.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 waypoints required' },
        { status: 400 }
      )
    }

    // Validate waypoint format
    const validWaypoints: [number, number][] = []
    for (const wp of waypoints) {
      if (
        Array.isArray(wp) &&
        wp.length === 2 &&
        typeof wp[0] === 'number' &&
        typeof wp[1] === 'number' &&
        wp[0] >= -90 && wp[0] <= 90 &&
        wp[1] >= -180 && wp[1] <= 180
      ) {
        validWaypoints.push(wp as [number, number])
      } else {
        return NextResponse.json(
          { error: 'Invalid waypoint format. Expected [lat, lng] pairs.' },
          { status: 400 }
        )
      }
    }

    const result = await getRoadRoute(validWaypoints)

    if (!result) {
      return NextResponse.json(
        { error: 'No route found' },
        { status: 404 }
      )
    }

    // Simplify to ~80 points for performance
    const simplified = simplifyRoute(result.coordinates, 80)

    return NextResponse.json({
      coordinates: simplified,
      distance: result.distance,
      duration: result.duration,
    }, {
      headers: { 'Cache-Control': 'public, max-age=86400' }, // Cache for 24 hours
    })
  } catch (error) {
    console.error('Routing error:', error)
    return NextResponse.json(
      { error: 'Routing failed' },
      { status: 500 }
    )
  }
}
