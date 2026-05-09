'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

export function useSocket() {
  const socketRef = useRef<Socket | null>(null)
  const [connected, setConnected] = useState(false)

  const getSocket = useCallback(() => socketRef.current, [])

  useEffect(() => {
    const s = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })
    socketRef.current = s

    s.on('connect', () => setConnected(true))
    s.on('disconnect', () => setConnected(false))

    return () => {
      s.disconnect()
    }
  }, [])

  return { getSocket, connected }
}
