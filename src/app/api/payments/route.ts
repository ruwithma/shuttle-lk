import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET - List payments with filters
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const busId = searchParams.get('busId')
    const studentId = searchParams.get('studentId')
    const month = searchParams.get('month')
    const paymentType = searchParams.get('paymentType')
    const paymentMethod = searchParams.get('paymentMethod')
    const ownerId = searchParams.get('ownerId')
    const driverId = searchParams.get('driverId')

    const where: Record<string, unknown> = {}

    if (studentId) where.studentId = studentId
    if (month) where.month = month
    if (paymentType) where.paymentType = paymentType
    if (paymentMethod) where.paymentMethod = paymentMethod

    // Determine busId filter - combine busId with ownerId/driverId constraints
    let busIdFilter: string | string[] | undefined = busId || undefined

    // Filter by owner's buses
    if (ownerId) {
      const ownedBuses = await db.bus.findMany({
        where: { ownerId },
        select: { id: true },
      })
      const ownerBusIds = ownedBuses.map(b => b.id)
      if (busIdFilter) {
        // Intersect: only include if busId matches owner's buses
        busIdFilter = Array.isArray(busIdFilter) ? busIdFilter : [busIdFilter]
        busIdFilter = busIdFilter.filter(id => ownerBusIds.includes(id))
        if (busIdFilter.length === 0) {
          return NextResponse.json([], { status: 200 })
        }
      } else {
        busIdFilter = ownerBusIds
      }
    }

    // Filter by driver's bus
    if (driverId) {
      const assignedBus = await db.bus.findFirst({
        where: { driverId },
        select: { id: true },
      })
      if (assignedBus) {
        if (busIdFilter) {
          // Intersect: only include if busId matches driver's bus
          const driverBusIds = Array.isArray(busIdFilter) ? busIdFilter : [busIdFilter]
          if (!driverBusIds.includes(assignedBus.id)) {
            return NextResponse.json([], { status: 200 })
          }
          busIdFilter = assignedBus.id
        } else {
          busIdFilter = assignedBus.id
        }
      } else {
        return NextResponse.json([], { status: 200 })
      }
    }

    // Apply busId filter
    if (busIdFilter) {
      where.busId = Array.isArray(busIdFilter) ? { in: busIdFilter } : busIdFilter
    }

    const payments = await db.payment.findMany({
      where,
      include: {
        student: { select: { id: true, name: true, phone: true } },
        bus: { select: { id: true, name: true, plateNumber: true } },
        subscription: { select: { id: true, paymentType: true, monthlyAmount: true, dailyAmount: true } },
        collector: { select: { id: true, name: true, role: true } },
      },
      orderBy: { date: 'desc' },
    })

    // Return flat array for frontend compatibility
    return NextResponse.json(payments, {
      status: 200,
      headers: { 'Cache-Control': 'private, max-age=10' },
    })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.error('Get payments error:', error)
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 })
  }
}

// POST - Create payment
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      studentId,
      busId,
      subscriptionId,
      amount,
      paymentMethod,
      paymentType,
      collectedById,
      date,
      note,
      month,
    } = body

    if (!studentId || !busId || !amount || !paymentMethod || !paymentType || !collectedById) {
      return NextResponse.json(
        { error: 'studentId, busId, amount, paymentMethod, paymentType, and collectedById are required' },
        { status: 400 }
      )
    }

    // Validate amount is a positive number
    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      )
    }

    // Validate references exist
    const student = await db.user.findUnique({ where: { id: studentId } })
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    const bus = await db.bus.findUnique({ where: { id: busId } })
    if (!bus) {
      return NextResponse.json({ error: 'Bus not found' }, { status: 404 })
    }

    const collector = await db.user.findUnique({ where: { id: collectedById } })
    if (!collector) {
      return NextResponse.json({ error: 'Collector not found' }, { status: 404 })
    }

    // For monthly payments, auto-populate month if not provided
    let effectiveMonth = month
    if (paymentType === 'MONTHLY' && !month) {
      const now = new Date()
      effectiveMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    }

    // For monthly payments, check if already paid for this month
    if (paymentType === 'MONTHLY' && effectiveMonth) {
      const existingPayment = await db.payment.findFirst({
        where: {
          studentId,
          busId,
          paymentType: 'MONTHLY',
          month: effectiveMonth,
        },
      })
      if (existingPayment) {
        return NextResponse.json(
          { error: `Student has already paid for month ${effectiveMonth}` },
          { status: 409 }
        )
      }
    }

    const payment = await db.payment.create({
      data: {
        studentId,
        busId,
        subscriptionId: subscriptionId || null,
        amount: parseFloat(String(amount)),
        paymentMethod,
        paymentType,
        collectedById,
        date: date ? new Date(date) : new Date(),
        note: note || null,
        month: effectiveMonth || null,
      },
      include: {
        student: { select: { id: true, name: true, phone: true } },
        bus: { select: { id: true, name: true, plateNumber: true } },
        collector: { select: { id: true, name: true } },
      },
    })

    // If this is a monthly payment, create a notification for the student
    if (paymentType === 'MONTHLY') {
      const monthLabel = effectiveMonth || 'this month'
      await db.notification.create({
        data: {
          userId: studentId,
          title: 'Payment Received',
          message: `Your monthly payment of LKR ${parseFloat(String(amount)).toLocaleString()} for ${monthLabel} has been recorded. Thank you!`,
          type: 'PAYMENT_RECEIVED',
        },
      })
    }

    // Return flat payment object for frontend compatibility
    return NextResponse.json(payment, { status: 201 })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.error('Create payment error:', error)
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 })
  }
}
