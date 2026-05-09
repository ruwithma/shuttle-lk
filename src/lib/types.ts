export type UserRole = 'OWNER' | 'DRIVER' | 'STUDENT'
export type PaymentType = 'DAILY' | 'MONTHLY'
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER'
export type ExpenseCategory = 'FUEL' | 'MAINTENANCE' | 'SALARY' | 'OTHER'
export type NotificationType = 'PAYMENT_REMINDER' | 'PAYMENT_RECEIVED' | 'GENERAL'

export interface User {
  id: string
  name: string
  phone: string
  email?: string
  role: UserRole
  avatar?: string
}

export interface Bus {
  id: string
  plateNumber: string
  name: string
  capacity: number
  routeName: string
  routeStart: string
  routeEnd: string
  routeStops: string
  routeCoordinates?: string
  routeStopCoordinates?: string
  currentLat?: number
  currentLng?: number
  ownerId: string
  driverId?: string
  active: boolean
  driver?: User
}

export interface RouteStop {
  name: string
  lat: number
  lng: number
  order: number
  estimatedMinutes?: number // minutes from start
}

export interface BusRoute {
  id: string
  busId: string
  name: string
  direction: string
  coordinates: [number, number][] // [lng, lat] pairs (MapLibre order)
  stops: RouteStop[]
  totalDistance?: number
  estimatedDuration?: number
  isActive: boolean
  recordedAt: string
}

export interface Subscription {
  id: string
  studentId: string
  busId: string
  paymentType: PaymentType
  monthlyAmount?: number
  dailyAmount?: number
  startDate: string
  endDate?: string
  active: boolean
  student?: User
  bus?: Bus
}

export interface Payment {
  id: string
  studentId: string
  busId: string
  subscriptionId?: string
  amount: number
  paymentMethod: PaymentMethod
  paymentType: PaymentType
  collectedById: string
  date: string
  note?: string
  month?: string
  student?: User
  collector?: User
  bus?: Bus
}

export interface Expense {
  id: string
  busId: string
  category: ExpenseCategory
  amount: number
  description?: string
  date: string
  recordedById: string
  bus?: Bus
  recorder?: User
}

export interface Notification {
  id: string
  userId: string
  title: string
  message: string
  type: NotificationType
  read: boolean
  createdAt: string
}

export interface DashboardStats {
  totalStudents: number
  monthlyIncome: number
  totalExpenses: number
  netProfit: number
  collectionRate: number
  recentPayments: Payment[]
  monthlyData: { month: string; income: number; expenses: number }[]
}

export interface DriverDashboard {
  todayCollection: number
  bus: Bus
  todayPayments: Payment[]
}

export interface StudentDashboard {
  paymentStatus: 'PAID' | 'UNPAID' | 'OVERDUE'
  nextDueDate?: string
  paymentHistory: Payment[]
  subscription: Subscription
  bus: Bus
}
