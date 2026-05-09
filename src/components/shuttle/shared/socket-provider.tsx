'use client'

import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react'
import { io, Socket } from 'socket.io-client'

interface SocketContextValue {
  socket: Socket | null
  connected: boolean
  getSocket: () => Socket | null
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  connected: false,
  getSocket: () => null,
})

export function SocketProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [socketInstance, setSocketInstance] = useState<Socket | null>(null)

  // Create socket on mount, destroy on unmount
  useEffect(() => {
    const s = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    })
    socketRef.current = s

    const onConnect = () => setConnected(true)
    const onDisconnect = () => setConnected(false)
    s.on('connect', onConnect)
    s.on('disconnect', onDisconnect)

    // Defer state update to avoid synchronous setState in effect
    queueMicrotask(() => setSocketInstance(s))

    return () => {
      s.off('connect', onConnect)
      s.off('disconnect', onDisconnect)
      s.disconnect()
      socketRef.current = null
      setSocketInstance(null)
    }
  }, [])

  const getSocket = useCallback(() => socketRef.current, [])

  return (
    <SocketContext.Provider value={{ socket: socketInstance, connected, getSocket }}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSharedSocket() {
  return useContext(SocketContext)
}
