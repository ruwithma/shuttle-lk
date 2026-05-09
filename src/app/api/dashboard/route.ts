import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const role = searchParams.get('role')

    if (!userId || !role) {
      return NextResponse.json({ error: 'userId and role are required' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

    if (role === 'OWNER') {
      // Get all buses owned by this user
      const ownedBuses = await db.bus.findMany({
        where: { ownerId: userId },
        select: { id: true },
      })
      const busIds = ownedBuses.map(b => b.id)

      // Total students (active subscriptions across owned buses)
      const totalSubscriptions = await db.subscription.count({
        where: { busId: { in: busIds }, active: true },
      })

      // Monthly income
      const monthlyPayments = await db.payment.findMany({
        where: {
          busId: { in: busIds },
          date: { gte: monthStart, lte: monthEnd },
        },
        select: { amount: true },
      })
      const monthlyIncome = monthlyPayments.reduce((sum, p) => sum + p.amount, 0)

      // Total expenses this month
      const monthlyExpenses = await db.expense.findMany({
        where: {
          busId: { in: busIds },
          date: { gte: monthStart, lte: monthEnd },
        },
        select: { amount: true },
      })
      const totalExpenses = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0)

      // Net profit
      const netProfit = monthlyIncome - totalExpenses

      // Payment collection rate - monthly students who have paid vs total monthly students
      const monthlySubscriptions = await db.subscription.findMany({
        where: { busId: { in: busIds }, paymentType: 'MONTHLY', active: true },
        select: { studentId: true },
      })
      const monthlyStudentIds = monthlySubscriptions.map(s => s.studentId)
      const paidMonthlyStudents = await db.payment.findMany({
        where: {
          studentId: { in: monthlyStudentIds },
          busId: { in: busIds },
          month: currentMonth,
          paymentType: 'MONTHLY',
        },
        select: { studentId: true },
      })
      const uniquePaidStudents = new Set(paidMonthlyStudents.map(p => p.studentId))
      const collectionRate = monthlyStudentIds.length > 0
        ? (uniquePaidStudents.size / monthlyStudentIds.length) * 100
        : 0

      // Recent payments
      const recentPayments = await db.payment.findMany({
        where: { busId: { in: busIds } },
        include: {
          student: { select: { id: true, name: true, phone: true } },
          bus: { select: { id: true, name: true } },
          collector: { select: { id: true, name: true } },
        },
        orderBy: { date: 'desc' },
        take: 10,
      })

      // Income vs expenses chart data (last 6 months)
      const chartData = []
      for (let i = 5; i >= 0; i--) {
        const chartMonth = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const chartMonthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59)
        const chartMonthStr = `${chartMonth.getFullYear()}-${String(chartMonth.getMonth() + 1).padStart(2, '0')}`

        const incomePayments = await db.payment.findMany({
          where: {
            busId: { in: busIds },
            date: { gte: chartMonth, lte: chartMonthEnd },
          },
          select: { amount: true },
        })
        const income = incomePayments.reduce((sum, p) => sum + p.amount, 0)

        const expenseRecords = await db.expense.findMany({
          where: {
            busId: { in: busIds },
            date: { gte: chartMonth, lte: chartMonthEnd },
          },
          select: { amount: true },
        })
        const expenses = expenseRecords.reduce((sum, e) => sum + e.amount, 0)

        chartData.push({
          month: chartMonthStr,
          income,
          expenses,
          profit: income - expenses,
        })
      }

      return NextResponse.json({
        role: 'OWNER',
        totalStudents: totalSubscriptions,
        monthlyIncome,
        totalExpenses,
        netProfit,
        collectionRate: Math.round(collectionRate * 10) / 10,
        recentPayments,
        monthlyData: chartData,
      }, { status: 200 })
    }

    if (role === 'DRIVER') {
      // Get assigned bus
      const assignedBus = await db.bus.findUnique({
        where: { driverId: userId },
        include: {
          owner: { select: { id: true, name: true, phone: true } },
        },
      })

      if (!assignedBus) {
        return NextResponse.json({ error: 'No bus assigned' }, { status: 404 })
      }

      // Today's collection
      const todayPayments = await db.payment.findMany({
        where: {
          busId: assignedBus.id,
          date: { gte: todayStart, lte: todayEnd },
        },
        include: {
          student: { select: { id: true, name: true, phone: true } },
        },
        orderBy: { date: 'desc' },
      })
      const todayCollection = todayPayments.reduce((sum, p) => sum + p.amount, 0)

      // Get subscriptions for this bus (for collect payment feature)
      const busSubscriptions = await db.subscription.findMany({
        where: { busId: assignedBus.id, active: true },
        include: {
          student: { select: { id: true, name: true, phone: true } },
        },
      })

      return NextResponse.json({
        role: 'DRIVER',
        bus: assignedBus,
        todayCollection,
        todayPayments,
        todayPaymentCount: todayPayments.length,
        subscriptions: busSubscriptions,
      }, { status: 200 })
    }

    if (role === 'STUDENT') {
      // Get subscriptions
      const subscriptions = await db.subscription.findMany({
        where: { studentId: userId, active: true },
        include: {
          bus: {
            select: {
              id: true,
              name: true,
              plateNumber: true,
              routeName: true,
              routeStart: true,
              routeEnd: true,
              routeStops: true,
              driver: { select: { id: true, name: true, phone: true } },
            },
          },
        },
      })

      // Check payment status for current month
      const monthlyPayments = await db.payment.findMany({
        where: {
          studentId: userId,
          month: currentMonth,
          paymentType: 'MONTHLY',
        },
      })
      const paidMonthly = monthlyPayments.length > 0

      // Daily payments this month
      const dailyPaymentsThisMonth = await db.payment.findMany({
        where: {
          studentId: userId,
          date: { gte: monthStart, lte: monthEnd },
          paymentType: 'DAILY',
        },
        orderBy: { date: 'desc' },
      })

      // Determine payment status
      let paymentStatus = 'UNPAID'
      let nextDueDate: string | null = null
      const monthlySub = subscriptions.find(s => s.paymentType === 'MONTHLY')
      const dailySub = subscriptions.find(s => s.paymentType === 'DAILY')

      if (monthlySub) {
        if (paidMonthly) {
          paymentStatus = 'PAID'
          // Next due date is the 1st of next month
          const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
          nextDueDate = nextMonth.toISOString()
        } else {
          paymentStatus = 'UNPAID'
          nextDueDate = monthStart.toISOString()
        }
      } else if (dailySub) {
        // For daily, check if paid today
        const todayPayments = await db.payment.findMany({
          where: {
            studentId: userId,
            date: { gte: todayStart, lte: todayEnd },
            paymentType: 'DAILY',
          },
        })
        paymentStatus = todayPayments.length > 0 ? 'PAID' : 'UNPAID'
        nextDueDate = now.toISOString()
      }

      // Payment history
      const paymentHistory = await db.payment.findMany({
        where: { studentId: userId },
        include: {
          bus: { select: { id: true, name: true } },
          collector: { select: { id: true, name: true } },
        },
        orderBy: { date: 'desc' },
        take: 20,
      })

      // Extract primary subscription and bus for frontend convenience
      const primarySub = monthlySub || dailySub || subscriptions[0]
      const bus = primarySub?.bus || null

      return NextResponse.json({
        role: 'STUDENT',
        paymentStatus,
        nextDueDate,
        subscriptions,
        subscription: primarySub,
        bus,
        paymentHistory,
        dailyPaymentsThisMonth,
        monthlyPaymentsPaid: paidMonthly,
      }, { status: 200 })
    }

    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  } catch (error) {
    console.error('Dashboard error:', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 })
  }
}
