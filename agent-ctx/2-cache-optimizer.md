# Task 2: Fix Duplicate API Calls and Add Data Caching

## Agent: cache-optimizer

## Work Log

- Read `/home/z/my-project/worklog.md` for full project context (Tasks 1-9)
- Read existing `/home/z/my-project/src/lib/store.ts` to understand current Zustand store structure
- Read `/home/z/my-project/src/lib/types.ts` to verify type imports

### Changes Made

#### 1. Rewrote `/home/z/my-project/src/lib/store.ts`
Added three new capabilities to the Zustand store:

**Cache timestamps (`_cache` + `isDataFresh` + `markDataLoaded`)**:
- Added `_cache: Record<string, number>` to track when each data slice was last loaded
- Added `isDataFresh(key)` method that returns `true` if data was loaded within the last 30 seconds (CACHE_TTL = 30_000ms)
- Added `markDataLoaded(key)` to manually stamp cache without setting data
- All data setters (`setBuses`, `setPayments`, etc.) now automatically update `_cache` timestamps via `set({ data, _cache: { ...get()._cache, key: Date.now() } })`

**Request deduplication (`_inFlight` + `getOrCreateRequest`)**:
- Added `_inFlight: Record<string, Promise<unknown>>` to track in-flight requests
- Added `getOrCreateRequest<T>(key, factory)` that returns existing promise if one is already in-flight for that key, otherwise creates and stores a new one
- Promises are auto-cleaned from `_inFlight` via `.finally()` when they resolve/reject

**Logout cleanup**:
- `logout()` now resets `_cache: {}` and `_inFlight: {}` along with all existing resets

All existing fields and functionality preserved (auth, navigation, data, UI state, location tracking).

#### 2. Created `/home/z/my-project/src/lib/data-fetcher.ts`
Centralized data fetching utility with 6 exported functions:

- `fetchDashboardData(userId, role, force?)` — Fetches role-appropriate dashboard data; uses cache key `${role}Dashboard`; deduplicates by `dashboard-${role}-${userId}`
- `fetchPayments(userId, role, force?)` — Fetches payments with role-appropriate query param (ownerId/driverId/studentId); deduplicates by `payments-${userId}`
- `fetchBuses(ownerId, force?)` — Fetches buses; deduplicates by `buses-${ownerId}`
- `fetchSubscriptions(busId, force?)` — Fetches subscriptions via `/api/students?busId=`; deduplicates by `subscriptions-${busId}`
- `fetchExpenses(busId, force?)` — Fetches expenses; deduplicates by `expenses-${busId}`
- `fetchNotifications(userId, force?)` — Fetches notifications; correctly extracts `data.notifications` from wrapped response; deduplicates by `notifications-${userId}`

Each function:
1. Checks cache freshness first (skips fetch if data is < 30s old, unless `force=true`)
2. Uses `getOrCreateRequest` to prevent duplicate in-flight requests for the same data
3. Stores results in the global Zustand store

### Verification
- Ran `npx eslint src/lib/store.ts src/lib/data-fetcher.ts` — passes clean, no errors
- Dev server logs confirm the problem: duplicate API calls visible (each endpoint hit twice on mount)
- These changes provide the infrastructure; components need to be updated to use `fetchX` functions instead of raw `fetch()` calls (separate task)

## Stage Summary
- Store now supports 30-second cache freshness checks and in-flight request deduplication
- Centralized data-fetcher module created with 6 functions covering all data endpoints
- All existing store functionality preserved; no breaking changes
- Lint passes clean on both files
