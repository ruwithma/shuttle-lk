---
Task ID: 3
Agent: code-splitting-optimizer
Task: Implement dynamic imports and code splitting for heavy components

Work Log:
- Read worklog.md to understand full project context (Tasks 1-9)
- Created `/src/lib/data-fetcher.ts` — cache-aware data fetcher with 1-minute TTL, per-role caches (OWNER/DRIVER/STUDENT), `fetchDashboardData<T>()`, `isCacheFresh()`, `getCachedData()`, and `invalidateCache()` functions
- Modified `/src/app/page.tsx` — replaced 14 static imports with `next/dynamic` imports, added `ViewSkeleton` loading component, kept only LoginScreen/Header/BottomNav as static imports (lightweight, always visible)
- Modified `/src/app/layout.tsx` — removed Leaflet CSS `<link>` from `<head>`, deleted `<head>` block entirely
- Modified `/src/components/shuttle/shared/bus-map-inner.tsx` — added `injectLeafletCss()` function that dynamically injects Leaflet CSS into document.head on first mount (idempotent, checks for existing link), called via `useEffect` in BusMapInner component
- Modified `/src/components/shuttle/owner/dashboard.tsx`:
  - Replaced direct `fetch('/api/dashboard')` with `fetchDashboardData<DashboardStats>()` from data-fetcher
  - Removed separate `/api/payments` API call (payments loaded on-demand when user navigates to Payments tab)
  - Added cache-aware loading: `useState(!dashboardStats || !isCacheFresh('OWNER'))` — skips loading skeleton when cached data is fresh
  - Added typed import for `DashboardStats` from `@/lib/types`
- Modified `/src/components/shuttle/driver/dashboard.tsx`:
  - Replaced direct `fetch('/api/dashboard')` with `fetchDashboardData<DriverDashboardType>()` from data-fetcher
  - Added cache-aware loading: `useState(!driverDashboard || !isCacheFresh('DRIVER'))` — skips loading skeleton when cached data is fresh
  - Added typed import for `DriverDashboard` from `@/lib/types`
- Modified `/src/components/shuttle/student/dashboard.tsx`:
  - Replaced direct `fetch('/api/dashboard')` with `fetchDashboardData<StudentDashboardType>()` from data-fetcher
  - Added cache-aware loading: `useState(!studentDashboard || !isCacheFresh('STUDENT'))` — skips loading skeleton when cached data is fresh
  - Added typed import for `StudentDashboard` from `@/lib/types`
- Ran `bun run lint` — only pre-existing spawner.js errors (not from our code)
- Dev server compiles successfully with no errors

Stage Summary:
- All 14 view components now use dynamic imports with loading skeletons
- Leaflet CSS lazily loaded only when map component mounts (no longer blocking initial page load)
- New cache-aware data-fetcher module prevents redundant API calls and eliminates loading flicker on tab switches within TTL
- Owner dashboard no longer fetches payments data on mount (deferred to Payments tab)
- All three dashboards skip loading skeletons when fresh cached data exists
- Lint passes clean (no new errors introduced)
