'use client'

import { create } from 'zustand'
import type {
  User,
  Bus,
  Subscription,
  Payment,
  Expense,
  Notification,
  DashboardStats,
  DriverDashboard,
  StudentDashboard,
} from '@/lib/types'

interface AppState {
  // Auth
  currentUser: User | null
  setCurrentUser: (user: User | null) => void

  // Navigation
  activeTab: string
  setActiveTab: (tab: string) => void

  // Data
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

  // UI State
  isLoading: boolean
  setIsLoading: (loading: boolean) => void

  // Helpers
  logout: () => void
}

export const useAppStore = create<AppState>((set) => ({
  // Auth
  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user }),

  // Navigation
  activeTab: 'dashboard',
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Data
  buses: [],
  setBuses: (buses) => set({ buses }),
  subscriptions: [],
  setSubscriptions: (subs) => set({ subscriptions: subs }),
  payments: [],
  setPayments: (payments) => set({ payments }),
  expenses: [],
  setExpenses: (expenses) => set({ expenses }),
  notifications: [],
  setNotifications: (notifs) => set({ notifications: notifs }),
  dashboardStats: null,
  setDashboardStats: (stats) => set({ dashboardStats: stats }),
  driverDashboard: null,
  setDriverDashboard: (data) => set({ driverDashboard: data }),
  studentDashboard: null,
  setStudentDashboard: (data) => set({ studentDashboard: data }),

  // UI State
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),

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
    }),
}))
