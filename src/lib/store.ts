'use client'

import { create } from 'zustand'
import type {
  User, Bus, Subscription, Payment, Expense, Notification,
  DashboardStats, DriverDashboard, StudentDashboard,
} from '@/lib/types'

// Cache duration in ms
const CACHE_TTL = 30_000

interface AppState {
  // Auth
  currentUser: User | null
  setCurrentUser: (user: User | null) => void

  // Navigation
  activeTab: string
  setActiveTab: (tab: string) => void

  // Data with cache timestamps
  buses: Bus[]
  setBuses: (buses: Bus[]) => void
  subscriptions: Subscription[]
  setSubscriptions: (subs: Subscription[]) => void
  payments: Payment[]
  setPayments: (payments: Payment[]) => void
  expenses: Expense[]
  setExpenses: (expenses: Expense[]) => void
  notifications: Notification[]
  setNotifications: (notifs: Notification[]) => void
  dashboardStats: DashboardStats | null
  setDashboardStats: (stats: DashboardStats | null) => void
  driverDashboard: DriverDashboard | null
  setDriverDashboard: (data: DriverDashboard | null) => void
  studentDashboard: StudentDashboard | null
  setStudentDashboard: (data: StudentDashboard | null) => void

  // Cache timestamps
  _cache: Record<string, number>
  isDataFresh: (key: string) => boolean
  markDataLoaded: (key: string) => void

  // In-flight request tracking to prevent duplicates
  _inFlight: Record<string, Promise<unknown>>
  getOrCreateRequest: <T>(key: string, factory: () => Promise<T>) => Promise<T>

  // UI State
  isLoading: boolean
  setIsLoading: (loading: boolean) => void

  // Location tracking state
  isDriverLive: boolean
  setIsDriverLive: (live: boolean) => void
  busLocations: Record<string, { lat: number; lng: number; speed?: number; heading?: number; timestamp?: string; isLive: boolean }>
  setBusLocations: (locations: Record<string, { lat: number; lng: number; speed?: number; heading?: number; timestamp?: string; isLive: boolean }>) => void
  updateBusLocation: (busId: string, location: { lat: number; lng: number; speed?: number; heading?: number; timestamp?: string; isLive: boolean }) => void

  // Helpers
  logout: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  // Auth
  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user }),

  // Navigation
  activeTab: 'dashboard',
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Data (setters also update cache timestamp)
  buses: [],
  setBuses: (buses) => set({ buses, _cache: { ...get()._cache, buses: Date.now() } }),
  subscriptions: [],
  setSubscriptions: (subs) => set({ subscriptions: subs, _cache: { ...get()._cache, subscriptions: Date.now() } }),
  payments: [],
  setPayments: (payments) => set({ payments, _cache: { ...get()._cache, payments: Date.now() } }),
  expenses: [],
  setExpenses: (expenses) => set({ expenses, _cache: { ...get()._cache, expenses: Date.now() } }),
  notifications: [],
  setNotifications: (notifs) => set({ notifications: notifs, _cache: { ...get()._cache, notifications: Date.now() } }),
  dashboardStats: null,
  setDashboardStats: (stats) => set({ dashboardStats: stats, _cache: { ...get()._cache, dashboardStats: Date.now() } }),
  driverDashboard: null,
  setDriverDashboard: (data) => set({ driverDashboard: data, _cache: { ...get()._cache, driverDashboard: Date.now() } }),
  studentDashboard: null,
  setStudentDashboard: (data) => set({ studentDashboard: data, _cache: { ...get()._cache, studentDashboard: Date.now() } }),

  // Cache timestamps
  _cache: {},
  isDataFresh: (key: string) => {
    const ts = get()._cache[key]
    return ts != null && Date.now() - ts < CACHE_TTL
  },
  markDataLoaded: (key: string) => {
    set({ _cache: { ...get()._cache, [key]: Date.now() } })
  },

  // Request deduplication
  _inFlight: {},
  getOrCreateRequest: <T,>(key: string, factory: () => Promise<T>): Promise<T> => {
    const state = get()
    const existing = state._inFlight[key]
    if (existing) return existing as Promise<T>

    const promise = factory().finally(() => {
      const s = get()
      const { [key]: _, ...rest } = s._inFlight
      set({ _inFlight: rest })
    })

    set({ _inFlight: { ...state._inFlight, [key]: promise } })
    return promise
  },

  // UI State
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),

  // Location tracking state
  isDriverLive: false,
  setIsDriverLive: (live) => set({ isDriverLive: live }),
  busLocations: {},
  setBusLocations: (locations) => set({ busLocations: locations }),
  updateBusLocation: (busId, location) =>
    set((state) => ({
      busLocations: { ...state.busLocations, [busId]: location },
    })),

  // Helpers
  logout: () =>
    set({
      currentUser: null,
      activeTab: 'dashboard',
      buses: [],
      subscriptions: [],
      payments: [],
      expenses: [],
      notifications: [],
      dashboardStats: null,
      driverDashboard: null,
      studentDashboard: null,
      isLoading: false,
      isDriverLive: false,
      busLocations: {},
      _cache: {},
      _inFlight: {},
    }),
}))
