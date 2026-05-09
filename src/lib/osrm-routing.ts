/**
 * OSRM Routing Utility
 * Uses the free OSRM demo server to get road-following route coordinates.
 * OSRM returns coordinates in [lng, lat] order (GeoJSON standard).
 */

interface OSRMResponse {
  code: string
  routes: Array<{
    geometry: {
      type: string
      coordinates: [number, number][] // [lng, lat] pairs
    }
    distance: number // meters
    duration: number // seconds
  }>
}

/**
 * Get a road-following route between waypoints using OSRM.
 * @param waypoints Array of [lat, lng] pairs (at least 2 points)
 * @returns Array of [lat, lng] pairs following roads, or null if routing fails
 */
export async function getRoadRoute(
  waypoints: [number, number][] // [lat, lng] pairs
): Promise<{ coordinates: [number, number][]; distance: number; duration: number } | null> {
  if (waypoints.length < 2) return null

  // OSRM expects coordinates as lng,lat separated by semicolons
  const coordsStr = waypoints
    .map(([lat, lng]) => `${lng},${lat}`)
    .join(';')

  const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'ShuttleLK/1.0' },
      signal: AbortSignal.timeout(15000), // 15 second timeout
    })

    if (!response.ok) {
      console.warn(`OSRM request failed: ${response.status}`)
      return null
    }

    const data: OSRMResponse = await response.json()

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      console.warn('OSRM returned no routes')
      return null
    }

    const route = data.routes[0]

    // Convert from [lng, lat] to [lat, lng] for our internal use
    const coordinates: [number, number][] = route.geometry.coordinates.map(
      ([lng, lat]) => [lat, lng] as [number, number]
    )

    return {
      coordinates,
      distance: route.distance,
      duration: route.duration,
    }
  } catch (error) {
    console.warn('OSRM routing error:', error)
    return null
  }
}

/**
 * Simplify route coordinates by reducing point density.
 * Keeps every nth point plus start/end.
 */
export function simplifyRoute(
  coords: [number, number][],
  targetPoints: number = 80
): [number, number][] {
  if (coords.length <= targetPoints) return coords

  const step = Math.max(1, Math.floor(coords.length / targetPoints))
  const simplified: [number, number][] = []

  for (let i = 0; i < coords.length; i += step) {
    simplified.push(coords[i])
  }

  // Always include the last point
  if (simplified[simplified.length - 1][0] !== coords[coords.length - 1][0] ||
      simplified[simplified.length - 1][1] !== coords[coords.length - 1][1]) {
    simplified.push(coords[coords.length - 1])
  }

  return simplified
}
