'use client'

import { useAppStore } from '@/lib/store'
import LoginScreen from '@/components/shuttle/login-screen'
import Header from '@/components/shuttle/header'
import BottomNav from '@/components/shuttle/bottom-nav'
import OwnerDashboard from '@/components/shuttle/owner/dashboard'
import BusManagement from '@/components/shuttle/owner/bus-management'
import StudentManagement from '@/components/shuttle/owner/student-management'
import PaymentTracking from '@/components/shuttle/owner/payment-tracking'
import OwnerMore from '@/components/shuttle/owner/owner-more'
import DriverDashboard from '@/components/shuttle/driver/dashboard'
import CollectPayment from '@/components/shuttle/driver/collect-payment'
import DriverHistory from '@/components/shuttle/driver/driver-history'
import StudentDashboard from '@/components/shuttle/student/dashboard'
import MyRoute from '@/components/shuttle/student/my-route'
import StudentPaymentHistory from '@/components/shuttle/student/payment-history'
import NotificationPanel from '@/components/shuttle/shared/notification-panel'
import ExpenseTracking from '@/components/shuttle/owner/expense-tracking'
import FleetTracking from '@/components/shuttle/owner/fleet-tracking'

export default function Home() {
  const { currentUser, activeTab } = useAppStore()

  if (!currentUser) return <LoginScreen />

  const renderContent = () => {
    // Owner views
    if (currentUser.role === 'OWNER') {
      switch (activeTab) {
        case 'dashboard':
          return <OwnerDashboard />
        case 'buses':
          return <BusManagement />
        case 'students':
          return <StudentManagement />
        case 'payments':
          return <PaymentTracking />
        case 'expenses':
          return <ExpenseTracking />
        case 'fleet-tracking':
          return <FleetTracking />
        case 'notifications':
          return <NotificationPanel />
        case 'more':
          return <OwnerMore />
        default:
          return <OwnerDashboard />
      }
    }

    // Driver views
    if (currentUser.role === 'DRIVER') {
      switch (activeTab) {
        case 'dashboard':
          return <DriverDashboard />
        case 'collect':
          return <CollectPayment />
        case 'driver-history':
          return <DriverHistory />
        case 'more':
          return <NotificationPanel />
        default:
          return <DriverDashboard />
      }
    }

    // Student views
    if (currentUser.role === 'STUDENT') {
      switch (activeTab) {
        case 'dashboard':
          return <StudentDashboard />
        case 'route':
          return <MyRoute />
        case 'payments':
          return <StudentPaymentHistory />
        case 'more':
          return <NotificationPanel />
        default:
          return <StudentDashboard />
      }
    }

    return <OwnerDashboard />
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 overflow-y-auto pb-20 max-w-lg mx-auto w-full">
        {renderContent()}
      </main>
      <BottomNav />
    </div>
  )
}
