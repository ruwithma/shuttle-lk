---
Task ID: 1
Agent: main
Task: Complete ShuttleLK overhaul - MapLibre, route recording, dark mode, visual routes

Work Log:
- Examined full codebase: all components, API routes, Prisma schema, WebSocket service
- Installed MapLibre GL JS (v5.24.0) replacing Leaflet/react-leaflet
- Added Route model to Prisma schema for storing recorded driver routes
- Pushed schema changes to SQLite database
- Created new ShuttleMap component (shuttle-map.tsx) with:
  - MapLibre GL JS rendering (GPU-accelerated, Uber-quality)
  - CARTO light/dark raster tiles (minimal, clean, free)
  - Animated route polylines with traveled/remaining segments
  - Smooth bus marker animation with ease-out quintic easing
  - Pulse effects for live buses
  - Speed badges and live indicators
  - Stop markers with time labels
  - Camera follow mode
  - Auto-fit bounds on load
  - Dark/light theme support
- Created ShuttleMap wrapper for SSR-safe dynamic import
- Created RouteRecorder component for drivers:
  - GPS recording with real geolocation + simulation fallback
  - Add stops during recording
  - Save routes with distance/duration calculations
  - View/delete saved routes
- Created /api/routes API endpoint (GET, POST, DELETE)
- Updated Student MyRoute with:
  - Visual route timeline with stop times
  - Dark mode support
  - Route data loading from recorded routes
  - Coordinate format handling ([lat,lng] and [lng,lat])
- Updated ShuttleFinder with dark mode and new map
- Updated FleetTracking with dark mode and new map
- Updated Header with dark mode toggle (animated sun/moon)
- Updated BottomNav with Route tab for drivers, dark mode
- Updated page.tsx with RouteRecorder dynamic import
- Updated layout.tsx with ThemeProvider from next-themes
- Updated globals.css with dark mode improvements, MapLibre styles
- Updated types.ts with RouteStop and BusRoute interfaces
- Removed old Leaflet components (bus-map.tsx, bus-map-inner.tsx, animated-marker.tsx)
- All lint checks passing (only pre-existing spawner.js errors)

Stage Summary:
- Complete map system overhaul: Leaflet → MapLibre GL JS
- Uber-quality animated bus tracking with smooth interpolation
- Driver route recording system (record once, display forever)
- Route timeline with estimated times at each stop
- Dark mode with animated toggle
- CARTO minimal map tiles (light_no_labels for Uber-like feel)
- Find Shuttles restricted to students only
- Clean, minimal map UI
