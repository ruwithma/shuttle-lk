# Task 5 - map-component-builder

## Task
Build Leaflet map components for route visualization and live tracking

## Files Created
- `/src/components/shuttle/shared/bus-map.tsx` — SSR-safe dynamic import wrapper
- `/src/components/shuttle/shared/bus-map-inner.tsx` — Full Leaflet map component
- `/src/components/shuttle/shared/use-socket.ts` — Socket.IO connection hook
- `/src/components/shuttle/shared/bus-location-hook.ts` — Bus location subscription hook

## Files Modified
- `/src/app/layout.tsx` — Added Leaflet CSS to `<head>`
- `/home/z/my-project/worklog.md` — Appended work record

## Key Decisions
- Used `getSocket()` callback pattern instead of returning socket ref during render to satisfy lint rules
- Used "adjust state during render" pattern for busId change detection instead of setState in effects
- Inlined fetch with `.then()` in effect instead of useCallback that calls setState
- Bus marker uses `L.divIcon` with custom HTML/CSS for pulsing animation
- MapBoundsFitter as a separate component inside MapContainer using `useMap()` hook
- All Leaflet code is dynamically imported with `{ ssr: false }` to prevent SSR issues

## Lint Status
Passes clean
