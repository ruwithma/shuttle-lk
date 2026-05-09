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

    if (busId) where.busId = busId
    if (studentId) where.studentId = studentId
    if (month) where.month = month
    if (paymentType) where.paymentType = paymentType
    if (paymentMethod) where.paymentMethod = paymentMethod

    // Filter by owner's buses
    if (ownerId) {
      const ownedBuses = await db.bus.findMany({
        where: { ownerId },
        select: { id: true },
      })
      const busIds = ownedBuses.map(b => b.id)
      where.busId = { in: busIds }
    }

    // Filter by driver's bus
    if (driverId) {
      const assignedBus = await db.bus.findUnique({
        where: { driverId },
        select: { id: true },
      })
      if (assignedBus) {
        where.busId = assignedBus.id
      } else {
        return NextResponse.json([], { status: 200 })
      }
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
    return NextResponse.json(payments, { status: 200 })
  } catch (error) {
    console.error('Get payments error:', error)
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

    // For monthly payments, check if already paid for this month
    if (paymentType === 'MONTHLY' && month) {
      const existingPayment = await db.payment.findFirst({
        where: {
          studentId,
          busId,
          paymentType: 'MONTHLY',
          month,
        },
      })
      if (existingPayment) {
        return NextResponse.json(
          { error: `Student has already paid for month ${month}` },
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
        month: month || null,
      },
      include: {
        student: { select: { id: true, name: true, phone: true } },
        bus: { select: { id: true, name: true, plateNumber: true } },
        collector: { select: { id: true, name: true } },
      },
    })

    // If this is a monthly payment, create a notification for the student
    if (paymentType === 'MONTHLY') {
      const monthLabel = month || 'this month'
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
    console.error('Create payment error:', error)
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 })
  }
}
