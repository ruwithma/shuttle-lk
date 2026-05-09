# Task 2-3: Fleet Tracking Fixer

## Task
Fix Fleet Tracking - Add Fleet tab to Owner nav + Show route paths on map

## Changes Made

### 1. Bottom Nav (`src/components/shuttle/bottom-nav.tsx`)
- Added `Radio` import from lucide-react
- Added `fleet-tracking` tab with Radio icon for OWNER role
- Positioned between dashboard and buses tabs
- Removed `students` tab (OWNER can access via dashboard/more menu)
- Owner now has 5 tabs: Home, Fleet, Buses, Payments, More

### 2. Fleet Tracking Component (`src/components/shuttle/owner/fleet-tracking.tsx`)
Complete overhaul:
- Added `selectedBusId` state for selecting individual buses
- `busRoutePaths` memo parses `routeCoordinates` from store buses with auto-detect coordinate format
- `selectedBusStops` memo parses `routeStopCoordinates` for stop markers
- `selectedBusLocation` memo for live position of selected bus
- Map shows route polyline when bus is selected (via `routePath` prop)
- Map shows stop markers along selected route
- Map height increased from 350px to 400px
- Fleet view (no selection): all buses as fleet markers
- Selected view: route path + live bus position + stops, camera follow
- Zoom: fleet=10, selected=14
- "Back to All Buses" button with ChevronLeft icon
- Detailed bus info card when selected (name, plate, route, speed, timestamp)
- Clickable bus list items with emerald ring highlight
- AnimatePresence for smooth transitions
- Full dark mode support

### 3. Page routing already existed
- `page.tsx` already had `case 'fleet-tracking': return <FleetTracking />` in OWNER switch

## Verification
- ESLint passes for modified files
- Dev server compiles successfully
