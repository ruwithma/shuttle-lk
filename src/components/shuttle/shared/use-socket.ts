'use client'

// This hook is now a wrapper around the shared socket provider.
// Prefer using useSharedSocket directly from socket-provider.tsx
import { useSharedSocket } from './socket-provider'

export function useSocket() {
  return useSharedSocket()
}
