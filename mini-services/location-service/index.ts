import { createServer } from 'http'
import { Server, Socket } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  // DO NOT change the path, it is used by Caddy to forward the request to the correct port
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// ── In-memory live bus tracking ──────────────────────────────────────────────

interface LiveBusData {
  busId: string
  lat: number
  lng: number
  speed?: number
  heading?: number
  driverName: string
  busName: string
  ownerId: string
  routeName?: string
  routeStart?: string
  routeEnd?: string
  plateNumber?: string
  timestamp: number
}

// Keyed by driver socket ID
const liveBuses = new Map<string, LiveBusData>()

// ── Types for incoming events ────────────────────────────────────────────────

interface DriverLocationPayload {
  busId: string
  lat: number
  lng: number
  speed?: number
  heading?: number
}

interface SubscribeBusPayload {
  busId: string
}

interface UnsubscribeBusPayload {
  busId: string
}

interface SubscribeOwnerPayload {
  ownerId: string
}

interface UnsubscribeOwnerPayload {
  ownerId: string
}

interface DriverStartPayload {
  busId: string
  ownerId: string
  driverName: string
  busName: string
  routeName?: string
  routeStart?: string
  routeEnd?: string
  plateNumber?: string
}

interface DriverStopPayload {
  busId: string
  ownerId: string
}

// subscribe-all-live: Students subscribe to get all live bus updates (no payload needed)

// ── Helper: find a live bus entry by busId ──────────────────────────────────

function findLiveBusByBusId(busId: string): { socketId: string; data: LiveBusData } | null {
  for (const [socketId, data] of liveBuses) {
    if (data.busId === busId) {
      return { socketId, data }
    }
  }
  return null
}

// ── Connection handler ──────────────────────────────────────────────────────

io.on('connection', (socket: Socket) => {
  console.log(`[connection] socket=${socket.id}`)

  // ── driver-location ────────────────────────────────────────────────────
  // Driver sends location update → broadcast to bus room, owner room, and all-live room
  socket.on('driver-location', (payload: DriverLocationPayload) => {
    const { busId, lat, lng, speed, heading } = payload
    const timestamp = Date.now()

    // Update or create live bus entry
    const existing = liveBuses.get(socket.id)
    if (existing) {
      existing.lat = lat
      existing.lng = lng
      existing.speed = speed ?? existing.speed
      existing.heading = heading ?? existing.heading
      existing.timestamp = timestamp
    } else {
      // First location from this driver
      liveBuses.set(socket.id, {
        busId,
        lat,
        lng,
        speed,
        heading,
        driverName: '',
        busName: '',
        ownerId: '',
        timestamp,
      })
    }

    const locationUpdate = {
      busId,
      lat,
      lng,
      speed,
      heading,
      timestamp,
    }

    // Broadcast to everyone subscribed to this bus
    io.to(`bus:${busId}`).emit('bus-location', locationUpdate)

    // Also broadcast to the owner room if we know the ownerId
    const liveData = liveBuses.get(socket.id)
    if (liveData?.ownerId) {
      io.to(`owner:${liveData.ownerId}`).emit('bus-location', locationUpdate)
    }

    // Broadcast to all-live subscribers (for student shuttle finder)
    const publicUpdate = {
      busId,
      lat,
      lng,
      speed,
      heading,
      busName: liveData?.busName || '',
      routeName: liveData?.routeName || '',
      timestamp,
    }
    io.to('all-live').emit('live-bus-update', publicUpdate)

    console.log(
      `[driver-location] bus=${busId} lat=${lat} lng=${lng} speed=${speed ?? '-'} heading=${heading ?? '-'}`
    )
  })

  // ── subscribe-bus ──────────────────────────────────────────────────────
  socket.on('subscribe-bus', (payload: SubscribeBusPayload) => {
    const { busId } = payload
    socket.join(`bus:${busId}`)
    console.log(`[subscribe-bus] socket=${socket.id} joined bus:${busId}`)

    // Immediately send last known location if available
    const live = findLiveBusByBusId(busId)
    if (live) {
      socket.emit('bus-location', {
        busId: live.data.busId,
        lat: live.data.lat,
        lng: live.data.lng,
        speed: live.data.speed,
        heading: live.data.heading,
        timestamp: live.data.timestamp,
      })
    }
  })

  // ── unsubscribe-bus ────────────────────────────────────────────────────
  socket.on('unsubscribe-bus', (payload: UnsubscribeBusPayload) => {
    const { busId } = payload
    socket.leave(`bus:${busId}`)
    console.log(`[unsubscribe-bus] socket=${socket.id} left bus:${busId}`)
  })

  // ── subscribe-owner ────────────────────────────────────────────────────
  socket.on('subscribe-owner', (payload: SubscribeOwnerPayload) => {
    const { ownerId } = payload
    socket.join(`owner:${ownerId}`)
    console.log(`[subscribe-owner] socket=${socket.id} joined owner:${ownerId}`)
  })

  // ── unsubscribe-owner ──────────────────────────────────────────────────
  socket.on('unsubscribe-owner', (payload: UnsubscribeOwnerPayload) => {
    const { ownerId } = payload
    socket.leave(`owner:${ownerId}`)
    console.log(`[unsubscribe-owner] socket=${socket.id} left owner:${ownerId}`)
  })

  // ── subscribe-all-live ─────────────────────────────────────────────────
  // Students subscribe to get all live bus updates (for shuttle finder)
  socket.on('subscribe-all-live', () => {
    socket.join('all-live')
    console.log(`[subscribe-all-live] socket=${socket.id} joined all-live`)

    // Immediately send all current live buses
    const buses: LiveBusData[] = Array.from(liveBuses.values())
    const publicBuses = buses.map(b => ({
      busId: b.busId,
      lat: b.lat,
      lng: b.lng,
      speed: b.speed,
      heading: b.heading,
      busName: b.busName,
      routeName: b.routeName || '',
      plateNumber: b.plateNumber || '',
      timestamp: b.timestamp,
    }))
    socket.emit('all-live-buses', publicBuses)
  })

  // ── unsubscribe-all-live ───────────────────────────────────────────────
  socket.on('unsubscribe-all-live', () => {
    socket.leave('all-live')
    console.log(`[unsubscribe-all-live] socket=${socket.id} left all-live`)
  })

  // ── driver-start ───────────────────────────────────────────────────────
  socket.on('driver-start', (payload: DriverStartPayload) => {
    const { busId, ownerId, driverName, busName, routeName, routeStart, routeEnd, plateNumber } = payload
    const timestamp = Date.now()

    // Upsert live bus entry
    const existing = liveBuses.get(socket.id)
    liveBuses.set(socket.id, {
      busId,
      lat: existing?.lat ?? 0,
      lng: existing?.lng ?? 0,
      speed: existing?.speed,
      heading: existing?.heading,
      driverName,
      busName,
      ownerId,
      routeName: routeName || existing?.routeName,
      routeStart: routeStart || existing?.routeStart,
      routeEnd: routeEnd || existing?.routeEnd,
      plateNumber: plateNumber || existing?.plateNumber,
      timestamp,
    })

    const startEvent = {
      busId,
      driverName,
      busName,
      timestamp,
    }

    // Notify owner room
    io.to(`owner:${ownerId}`).emit('driver-started', startEvent)

    // Also notify anyone already subscribed to this bus
    io.to(`bus:${busId}`).emit('driver-started', startEvent)

    // Notify all-live subscribers
    io.to('all-live').emit('live-bus-started', {
      busId,
      busName,
      routeName: routeName || '',
      plateNumber: plateNumber || '',
      timestamp,
    })

    console.log(
      `[driver-start] socket=${socket.id} bus=${busId} driver=${driverName} busName=${busName} owner=${ownerId}`
    )
  })

  // ── driver-stop ────────────────────────────────────────────────────────
  socket.on('driver-stop', (payload: DriverStopPayload) => {
    const { busId, ownerId } = payload

    const liveData = liveBuses.get(socket.id)
    if (liveData && liveData.busId === busId) {
      liveBuses.delete(socket.id)
    }

    const timestamp = Date.now()

    // Notify owner room
    io.to(`owner:${ownerId}`).emit('driver-stopped', {
      busId,
      timestamp,
    })

    // Also notify anyone subscribed to this bus
    io.to(`bus:${busId}`).emit('driver-stopped', {
      busId,
      timestamp,
    })

    // Notify all-live subscribers
    io.to('all-live').emit('live-bus-stopped', {
      busId,
      timestamp,
    })

    console.log(`[driver-stop] socket=${socket.id} bus=${busId} owner=${ownerId}`)
  })

  // ── get-live-buses ─────────────────────────────────────────────────────
  socket.on('get-live-buses', () => {
    const buses: LiveBusData[] = Array.from(liveBuses.values())
    socket.emit('live-buses', buses)
    console.log(`[get-live-buses] socket=${socket.id} sent ${buses.length} live buses`)
  })

  // ── disconnect ─────────────────────────────────────────────────────────
  socket.on('disconnect', (reason) => {
    const liveData = liveBuses.get(socket.id)
    if (liveData) {
      // Notify owner that driver disconnected
      if (liveData.ownerId) {
        io.to(`owner:${liveData.ownerId}`).emit('driver-stopped', {
          busId: liveData.busId,
          timestamp: Date.now(),
          reason: 'disconnect',
        })
      }

      // Notify bus subscribers
      io.to(`bus:${liveData.busId}`).emit('driver-stopped', {
        busId: liveData.busId,
        timestamp: Date.now(),
        reason: 'disconnect',
      })

      // Notify all-live subscribers
      io.to('all-live').emit('live-bus-stopped', {
        busId: liveData.busId,
        timestamp: Date.now(),
        reason: 'disconnect',
      })

      // Remove from live map
      liveBuses.delete(socket.id)
      console.log(
        `[disconnect] socket=${socket.id} was driver of bus=${liveData.busId}, removed from live map (reason: ${reason})`
      )
    } else {
      console.log(`[disconnect] socket=${socket.id} (reason: ${reason})`)
    }
  })

  // ── error ──────────────────────────────────────────────────────────────
  socket.on('error', (error) => {
    console.error(`[error] socket=${socket.id}:`, error)
  })
})

// ── Start server ─────────────────────────────────────────────────────────────

const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`🚌 Location tracking WebSocket server running on port ${PORT}`)
})

// ── Graceful shutdown ────────────────────────────────────────────────────────

process.on('SIGTERM', () => {
  console.log('Received SIGTERM signal, shutting down server...')
  httpServer.close(() => {
    console.log('Location tracking server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('Received SIGINT signal, shutting down server...')
  httpServer.close(() => {
    console.log('Location tracking server closed')
    process.exit(0)
  })
})
