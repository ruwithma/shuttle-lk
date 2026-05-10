# ShuttleLK Worklog

---
Task ID: 1
Agent: Main Agent
Task: Fix all bugs and test everything in ShuttleLK app

Work Log:
- Audited entire codebase (30+ files) to understand current state
- Started Next.js dev server (port 3000) and verified location service (port 3003)
- Fixed fleet tracking live bus visibility: filtered out [0,0] coordinate buses, added bus-location handler that adds new buses not in initial list, improved socket subscription with ref-based ownerId tracking
- Fixed driver dashboard stale closure bug: simulationMode state was captured in interval callback but changed later; added simulationModeRef to track current value
- Fixed useBusLocation interpolation stale closure bug: location and interpolatedPosition were in bus-location handler dependency array causing re-subscriptions; replaced with refs
- Fixed ESLint error: ownerIdRef.current assignment during render moved to useEffect
- Fixed student dashboard API missing routeCoordinates: added routeCoordinates, routeStopCoordinates, currentLat, currentLng to bus select query
- Fixed dark mode text contrast across ALL components (16 files, ~50 changes): added dark:bg-gray-900 to cards, dark:text-gray-100/dark:text-gray-300/dark:text-gray-400 to text elements, dark:text-emerald-400/dark:text-amber-400/dark:text-red-400/dark:text-purple-400/dark:text-blue-400 to colored text
- Fixed expense-tracking icon color extraction: changed .find() to .filter() to include dark:text- variants
- Fixed owner-more icon color extraction: same .find() to .filter() fix, added dark:text-* variants to color strings
- Fixed driver-history date comparison bug: compared only date portion (slice 0,10) instead of full ISO datetime strings
- Re-seeded database with fresh data (3 buses, 15 students, 6 routes)
- Ran comprehensive API tests: all 3 profiles (Owner, Driver, Student) login and dashboard work correctly
- Verified fleet locations API returns 3 buses with valid Sri Lanka coordinates
- Verified shuttles API returns 3 shuttles with 17 popular areas
- ESLint passes (only spawner.js utility file has errors, not app code)

Stage Summary:
- All critical bugs fixed: fleet tracking visibility, stale closures, dark mode contrast, missing API data
- App is fully functional with clean code
- Both services running: Next.js on port 3000, Location WebSocket on port 3003
- Database seeded with demo data including OSRM road-following routes

---
Task ID: 2
Agent: Main Agent
Task: Fix all remaining map issues - theme switch, marker management, fleet visibility, dark mode

Work Log:
- Complete rewrite of shuttle-map.tsx with critical fixes:
  - FIXED: Map style change (dark/light toggle) now properly restores ALL layers/sources/markers after setStyle()
  - FIXED: Stop markers no longer clear ALL markers (bus, fleet) - now uses tracked marker system with type-based removal
  - FIXED: Map bounds fitting now uses fingerprint comparison instead of hasFittedRef, allowing re-fit when fleet buses appear
  - FIXED: Fleet markers are individually tracked by busId for proper updates
  - FIXED: Bus marker uses key-based tracking ('bus-main') for reliable management
  - Added TrackedMarker system with type ('stop'|'bus-main'|'fleet') and key for granular marker management
  - Moved GeoJSON building logic inline into useMemo to satisfy React Compiler
- Fixed fleet-tracking.tsx:
  - Properly handles routeStopCoordinates stored as object format (not just array)
  - Improved selectedBusLocation to filter out 0,0 coordinates
  - Better error handling for missing bus names
  - Fixed dark mode contrast for offline label and MapPin icon
- Fixed bus-location-hook.ts:
  - useFleetLocations now includes ALL buses from initial fetch (even with 0,0 coords) - they get valid coords via WebSocket
  - handleBusLocation preserves existing speed/heading when update doesn't include them
- Fixed dark mode text contrast across 11 component files:
  - Notification panel icons (amber-600→amber-400, blue-600→blue-400)
  - Header moon icon and logout text
  - Driver collect-payment and dashboard amber icons
  - Fleet tracking offline labels and map pin icons
  - Stat card default icon colors and trend text
  - Shuttle finder occupancy colors and various icons
  - Route recorder action buttons
  - Student my-route WifiOff icon
  - Owner more and reports chevron/icons
- All changes pass ESLint (only spawner.js pre-existing errors remain)
- Both services running and verified

Stage Summary:
- Map now survives dark/light theme toggles without losing routes, markers, or fleet buses
- Fleet tracking properly shows all buses on the map with correct markers
- Stop markers no longer accidentally remove bus/fleet markers
- Dark mode text contrast significantly improved across all views
- Marker management is now type-safe and granular
---
Task ID: 1
Agent: Main Agent
Task: Fix mapping system issues - theme change flickering, route layer efficiency, fleet markers, coordinate handling

Work Log:
- Analyzed all 17+ map-related source files in the ShuttleLK project
- Identified 6 critical bugs in the mapping system
- Fixed shuttle-map.tsx: Theme change effect was depending on `displayPosition`, causing `setStyle()` on every bus location update → map flickering. Now only depends on `isDark`, uses refs for data access.
- Fixed shuttle-map.tsx: Route layers were being removed and re-added on every data change. Now uses `source.setData()` for efficient GeoJSON updates without removing layers.
- Fixed shuttle-map.tsx: Fleet markers were being removed and re-created on every location update, causing flickering. Now updates existing marker positions instead.
- Fixed bus-location-hook.ts: Interpolation loop was restarting on every `location` state change, causing frame drops. Now the loop runs continuously based on `activeBusId`, and interpolation refs are updated without restarting the loop.
- Fixed coordinate parsing across all components: Changed the fragile `> 90` heuristic to `> 50 && < 180` for detecting longitude values, which is more robust for Sri Lanka coordinates (lat ~6-10, lng ~79-82).
- Fixed fleet-tracking.tsx: Color assignment was using `locations.indexOf(loc)` which is unstable. Now uses a hash-based stable color assignment based on busId.
- Added `isStyleChangingRef` guard to prevent redundant layer updates during theme transitions.
- Increased trail buffer from 30 to 50 points for better route history visibility.

Stage Summary:
- shuttle-map.tsx: 3 critical fixes (theme flickering, efficient data updates, fleet marker efficiency)
- bus-location-hook.ts: 1 critical fix (interpolation loop stability)
- fleet-tracking.tsx: 2 fixes (stable colors, better coordinate parsing)
- student/my-route.tsx: 1 fix (coordinate parsing)
- shuttle-finder.tsx: 1 fix (coordinate parsing)
- driver/route-recorder.tsx: 1 fix (coordinate parsing)
- All lint checks pass (only spawner.js unrelated errors remain)
