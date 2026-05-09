'use client'

import { useAppStore } from '@/lib/store'
import dynamic from 'next/dynamic'
import LoginScreen from '@/components/shuttle/login-screen'
import Header from '@/components/shuttle/header'
import BottomNav from '@/components/shuttle/bottom-nav'
import { SocketProvider } from '@/components/shuttle/shared/socket-provider'

// Loading skeleton
function ViewSkeleton() {
  return (
    <div className="p-4 space-y-4">
      <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse w-48" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-24 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
        <div className="h-24 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
      </div>
      <div className="h-48 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
    </div>
  )
}

// Dynamic imports - code splitting for performance
const OwnerDashboard = dynamic(() => import('@/components/shuttle/owner/dashboard'), { loading: () => <ViewSkeleton /> })
const BusManagement = dynamic(() => import('@/components/shuttle/owner/bus-management'), { loading: () => <ViewSkeleton /> })
const StudentManagement = dynamic(() => import('@/components/shuttle/owner/student-management'), { loading: () => <ViewSkeleton /> })
const PaymentTracking = dynamic(() => import('@/components/shuttle/owner/payment-tracking'), { loading: () => <ViewSkeleton /> })
const OwnerMore = dynamic(() => import('@/components/shuttle/owner/owner-more'), { loading: () => <ViewSkeleton /> })
const ExpenseTracking = dynamic(() => import('@/components/shuttle/owner/expense-tracking'), { loading: () => <ViewSkeleton /> })
const FleetTracking = dynamic(() => import('@/components/shuttle/owner/fleet-tracking'), { loading: () => <ViewSkeleton /> })
const DriverDashboard = dynamic(() => import('@/components/shuttle/driver/dashboard'), { loading: () => <ViewSkeleton /> })
const CollectPayment = dynamic(() => import('@/components/shuttle/driver/collect-payment'), { loading: () => <ViewSkeleton /> })
const DriverHistory = dynamic(() => import('@/components/shuttle/driver/driver-history'), { loading: () => <ViewSkeleton /> })
const RouteRecorder = dynamic(() => import('@/components/shuttle/driver/route-recorder'), { loading: () => <ViewSkeleton /> })
const StudentDashboard = dynamic(() => import('@/components/shuttle/student/dashboard'), { loading: () => <ViewSkeleton /> })
const MyRoute = dynamic(() => import('@/components/shuttle/student/my-route'), { loading: () => <ViewSkeleton /> })
const StudentPaymentHistory = dynamic(() => import('@/components/shuttle/student/payment-history'), { loading: () => <ViewSkeleton /> })
const NotificationPanel = dynamic(() => import('@/components/shuttle/shared/notification-panel'), { loading: () => <ViewSkeleton /> })
const ShuttleFinder = dynamic(() => import('@/components/shuttle/shuttle-finder'), { loading: () => <ViewSkeleton /> })

function AppContent() {
  const { currentUser, activeTab } = useAppStore()

  if (!currentUser) return <LoginScreen />

  const renderContent = () => {
    // Student-only views
    if (activeTab === 'find' && currentUser.role === 'STUDENT') return <ShuttleFinder />

    // Owner views
    if (currentUser.role === 'OWNER') {
      switch (activeTab) {
        case 'dashboard': return <OwnerDashboard />
        case 'buses': return <BusManagement />
        case 'students': return <StudentManagement />
        case 'payments': return <PaymentTracking />
        case 'expenses': return <ExpenseTracking />
        case 'fleet-tracking': return <FleetTracking />
        case 'notifications': return <NotificationPanel />
        case 'more': return <OwnerMore />
        default: return <OwnerDashboard />
      }
    }

    // Driver views
    if (currentUser.role === 'DRIVER') {
      switch (activeTab) {
        case 'dashboard': return <DriverDashboard />
        case 'collect': return <CollectPayment />
        case 'record-route': return <RouteRecorder />
        case 'driver-history': return <DriverHistory />
        case 'more': return <NotificationPanel />
        default: return <DriverDashboard />
      }
    }

    // Student views
    if (currentUser.role === 'STUDENT') {
      switch (activeTab) {
        case 'dashboard': return <StudentDashboard />
        case 'route': return <MyRoute />
        case 'payments': return <StudentPaymentHistory />
        case 'more': return <NotificationPanel />
        default: return <StudentDashboard />
      }
    }

    return <OwnerDashboard />
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      <Header />
      <main className="flex-1 overflow-y-auto pb-20 max-w-lg mx-auto w-full">
        {renderContent()}
      </main>
      <BottomNav />
    </div>
  )
}

export default function Home() {
  return (
    <SocketProvider>
      <AppContent />
    </SocketProvider>
  )
}
