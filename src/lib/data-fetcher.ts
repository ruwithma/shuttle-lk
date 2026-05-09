/**
 * Cache-aware data fetcher for ShuttleLK.
 *
 * Combines:
 * - In-memory cache with TTL (1 minute for dashboards)
 * - Zustand store integration for request deduplication via getOrCreateRequest
 * - Store cache freshness tracking
 */

import { useAppStore } from '@/lib/store'

const DASHBOARD_CACHE_TTL = 60_000 // 1 minute

// Per-role dashboard caches for instant re-render
interface CacheEntry<T> {
  data: T
  timestamp: number
}

let ownerCache: CacheEntry<unknown> | null = null
let driverCache: CacheEntry<unknown> | null = null
let studentCache: CacheEntry<unknown> | null = null

function getCache(role: string): CacheEntry<unknown> | null {
  switch (role) {
    case 'OWNER': return ownerCache
    case 'DRIVER': return driverCache
    case 'STUDENT': return studentCache
    default: return null
  }
}

function setCache(role: string, data: unknown): void {
  const entry: CacheEntry<unknown> = { data, timestamp: Date.now() }
  switch (role) {
    case 'OWNER': ownerCache = entry; break
    case 'DRIVER': driverCache = entry; break
    case 'STUDENT': studentCache = entry; break
  }
}

/** Check whether the local cache for a given role is still fresh (within TTL). */
export function isCacheFresh(role: string): boolean {
  const entry = getCache(role)
  if (!entry) return false
  return Date.now() - entry.timestamp < DASHBOARD_CACHE_TTL
}

/** Get cached data for a role (may be stale). Returns `undefined` if no cache. */
export function getCachedData<T = unknown>(role: string): T | undefined {
  const entry = getCache(role)
  return entry ? (entry.data as T) : undefined
}

/**
 * Fetch dashboard data from the API.
 * - Uses request deduplication from the store
 * - Updates local cache for fast re-renders
 * - Also checks store cache to avoid unnecessary requests
 * Returns the fetched data or `null` on failure.
 */
export async function fetchDashboardData<T = unknown>(
  userId: string,
  role: string,
): Promise<T | null> {
  const store = useAppStore.getState()
  const storeKey = `${role}Dashboard`

  // Check store cache first (30s TTL from store)
  if (store.isDataFresh(storeKey)) {
    const cached = getCache(role)
    if (cached) return cached.data as T
  }

  try {
    const data = await store.getOrCreateRequest<T>(
      `dashboard-${role}-${userId}`,
      async () => {
        const res = await fetch(`/api/dashboard?userId=${userId}&role=${role}`)
        if (!res.ok) throw new Error('Failed to fetch dashboard')
        return res.json() as Promise<T>
      },
    )

    // Update local cache
    setCache(role, data)
    // Mark store cache as fresh
    store.markDataLoaded(storeKey)

    return data
  } catch {
    // silently fail — caller should handle null
  }
  return null
}

/**
 * Fetch payments with caching and deduplication.
 */
export async function fetchPayments(userId: string, role: string, force = false): Promise<void> {
  const store = useAppStore.getState()

  if (!force && store.isDataFresh('payments')) return

  const paramKey = role === 'OWNER' ? 'ownerId' : role === 'DRIVER' ? 'driverId' : 'studentId'

  await store.getOrCreateRequest(`payments-${userId}`, async () => {
    const res = await fetch(`/api/payments?${paramKey}=${userId}`)
    if (!res.ok) throw new Error('Failed to fetch payments')
    const data = await res.json()
    store.setPayments(Array.isArray(data) ? data : [])
  })
}

/**
 * Fetch buses with caching and deduplication.
 */
export async function fetchBuses(ownerId: string, force = false): Promise<void> {
  const store = useAppStore.getState()

  if (!force && store.isDataFresh('buses')) return

  await store.getOrCreateRequest(`buses-${ownerId}`, async () => {
    const res = await fetch(`/api/buses?ownerId=${ownerId}`)
    if (!res.ok) throw new Error('Failed to fetch buses')
    const data = await res.json()
    store.setBuses(Array.isArray(data) ? data : [])
  })
}

/**
 * Fetch notifications with caching and deduplication.
 */
export async function fetchNotifications(userId: string, force = false): Promise<void> {
  const store = useAppStore.getState()

  if (!force && store.isDataFresh('notifications')) return

  await store.getOrCreateRequest(`notifications-${userId}`, async () => {
    const res = await fetch(`/api/notifications?userId=${userId}`)
    if (!res.ok) throw new Error('Failed to fetch notifications')
    const data = await res.json()
    store.setNotifications(data.notifications || [])
  })
}

/** Invalidate cache for a specific role (e.g. on logout). */
export function invalidateCache(role?: string): void {
  if (!role || role === 'OWNER') ownerCache = null
  if (!role || role === 'DRIVER') driverCache = null
  if (!role || role === 'STUDENT') studentCache = null
}
