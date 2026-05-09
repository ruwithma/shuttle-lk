# Task ID: 2 - Schema Updater

## Task: Update Prisma schema for maps and live tracking

### Work Log
- Read existing worklog.md to understand previous work (Task 1: full-stack shuttle app built)
- Read current prisma/schema.prisma to understand existing schema
- Added `routeCoordinates String @default("")` to Bus model - stores JSON array of lat/lng coordinate pairs for full route path
- Added `routeStopCoordinates String @default("")` to Bus model - stores JSON object mapping stop names to coordinates
- Added `currentLat Float?` to Bus model - optional field for bus's current latitude
- Added `currentLng Float?` to Bus model - optional field for bus's current longitude
- Added `locationUpdatedAt DateTime?` to Bus model - timestamp of last location update
- Added `BusLocation` model with id, busId, lat, lng, speed, heading, timestamp fields and relation to Bus
- Added `locations BusLocation[]` relation to Bus model
- Ran `bun run db:push` - successfully synced database with new schema
- Ran `bun run db:generate` - successfully regenerated Prisma Client v6.19.2
- Verified final schema is valid and all changes are correct

### Stage Summary
- Bus model now has 5 new fields: routeCoordinates, routeStopCoordinates, currentLat, currentLng, locationUpdatedAt
- New BusLocation model created for location history tracking with speed/heading support
- Bus-to-BusLocation one-to-many relation established
- Database is in sync, Prisma Client regenerated
- Schema ready for live bus tracking and route map features
