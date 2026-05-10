import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET - List students with their subscriptions
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const ownerId = searchParams.get('ownerId')
    const busId = searchParams.get('busId')

    let busIds: string[] = []

    if (ownerId) {
      // Get all buses owned by this owner
      const ownedBuses = await db.bus.findMany({
        where: { ownerId },
        select: { id: true },
      })
      busIds = ownedBuses.map(b => b.id)
    }

    if (busId) {
      // If both ownerId and busId provided, intersect; if only busId, use it
      if (ownerId) {
        busIds = busIds.includes(busId) ? [busId] : []
      } else {
        busIds = [busId]
      }
    }

    // Find subscriptions for the buses
    const subscriptions = await db.subscription.findMany({
      where: busIds.length > 0 ? { busId: { in: busIds } } : {},
      include: {
        student: {
          select: { id: true, name: true, phone: true, email: true, avatar: true, createdAt: true },
        },
        bus: {
          select: { id: true, name: true, plateNumber: true, routeName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Return flat subscriptions array for frontend compatibility
    return NextResponse.json(subscriptions, { status: 200 })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.error('Get students error:', error)
    return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 })
  }
}

// POST - Add student + create subscription
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      studentId, // For existing student subscribing
      name,
      phone,
      email,
      password,
      // Subscription fields
      busId,
      paymentType,
      monthlyAmount,
      dailyAmount,
      startDate,
    } = body

    if (!busId || !paymentType) {
      return NextResponse.json({ error: 'busId and paymentType are required' }, { status: 400 })
    }

    // Check if bus exists
    const bus = await db.bus.findUnique({ where: { id: busId } })
    if (!bus) {
      return NextResponse.json({ error: 'Bus not found' }, { status: 404 })
    }

    // Mode 1: Existing student subscribing to a shuttle
    if (studentId) {
      const existingStudent = await db.user.findUnique({ where: { id: studentId } })
      if (!existingStudent || existingStudent.role !== 'STUDENT') {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 })
      }

      // Check if already subscribed
      const existingSub = await db.subscription.findFirst({
        where: { studentId, busId, active: true },
      })
      if (existingSub) {
        return NextResponse.json({ error: 'Already subscribed to this shuttle' }, { status: 409 })
      }

      const subscription = await db.subscription.create({
        data: {
          studentId,
          busId,
          paymentType,
          monthlyAmount: paymentType === 'MONTHLY' ? (monthlyAmount || null) : null,
          dailyAmount: paymentType === 'DAILY' ? (dailyAmount || null) : null,
          startDate: new Date(),
          active: true,
        },
        include: {
          bus: { select: { id: true, name: true, plateNumber: true, routeName: true } },
        },
      })

      return NextResponse.json({ subscription }, { status: 201 })
    }

    // Mode 2: Owner adding a new student
    if (!name || !phone) {
      return NextResponse.json({ error: 'name and phone are required for new students' }, { status: 400 })
    }

    // Check if phone already exists
    const existingUser = await db.user.findUnique({ where: { phone } })
    if (existingUser) {
      return NextResponse.json({ error: 'User with this phone number already exists' }, { status: 409 })
    }

    const result = await db.$transaction(async (tx) => {
      // Create student
      const student = await tx.user.create({
        data: {
          name,
          phone,
          email: email || null,
          password: password || '123456',
          role: 'STUDENT',
        },
      })

      // Create subscription
      const subscription = await tx.subscription.create({
        data: {
          studentId: student.id,
          busId,
          paymentType,
          monthlyAmount: paymentType === 'MONTHLY' ? (monthlyAmount || null) : null,
          dailyAmount: paymentType === 'DAILY' ? (dailyAmount || null) : null,
          startDate: startDate ? new Date(startDate) : new Date(),
          active: true,
        },
        include: {
          bus: { select: { id: true, name: true, plateNumber: true, routeName: true } },
        },
      })

      return { student, subscription }
    })

    return NextResponse.json({ data: result }, { status: 201 })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.error('Create student error:', error)
    return NextResponse.json({ error: 'Failed to create student' }, { status: 500 })
  }
}

// PUT - Update student or subscription
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { studentId, subscriptionId, ...fieldsToUpdate } = body

    if (!studentId && !subscriptionId) {
      return NextResponse.json({ error: 'studentId or subscriptionId is required' }, { status: 400 })
    }

    const result = await db.$transaction(async (tx) => {
      const updates: { student?: unknown; subscription?: unknown } = {}

      // Update student if student fields provided
      if (studentId) {
        const studentFields: Record<string, unknown> = {}
        if (fieldsToUpdate.name) studentFields.name = fieldsToUpdate.name
        if (fieldsToUpdate.phone) studentFields.phone = fieldsToUpdate.phone
        if (fieldsToUpdate.email !== undefined) studentFields.email = fieldsToUpdate.email
        if (fieldsToUpdate.avatar !== undefined) studentFields.avatar = fieldsToUpdate.avatar
        if (fieldsToUpdate.password) studentFields.password = fieldsToUpdate.password

        if (Object.keys(studentFields).length > 0) {
          const existingStudent = await tx.user.findUnique({ where: { id: studentId } })
          if (!existingStudent) {
            throw new Error('Student not found')
          }
          updates.student = await tx.user.update({
            where: { id: studentId },
            data: studentFields,
          })
        }
      }

      // Update subscription if subscription fields provided
      if (subscriptionId) {
        const subFields: Record<string, unknown> = {}
        if (fieldsToUpdate.paymentType) subFields.paymentType = fieldsToUpdate.paymentType
        if (fieldsToUpdate.monthlyAmount !== undefined) subFields.monthlyAmount = fieldsToUpdate.monthlyAmount
        if (fieldsToUpdate.dailyAmount !== undefined) subFields.dailyAmount = fieldsToUpdate.dailyAmount
        if (fieldsToUpdate.busId) subFields.busId = fieldsToUpdate.busId
        if (fieldsToUpdate.active !== undefined) subFields.active = fieldsToUpdate.active
        if (fieldsToUpdate.endDate) subFields.endDate = new Date(fieldsToUpdate.endDate)

        if (Object.keys(subFields).length > 0) {
          const existingSub = await tx.subscription.findUnique({ where: { id: subscriptionId } })
          if (!existingSub) {
            throw new Error('Subscription not found')
          }
          updates.subscription = await tx.subscription.update({
            where: { id: subscriptionId },
            data: subFields,
            include: {
              bus: { select: { id: true, name: true, plateNumber: true, routeName: true } },
            },
          })
        }
      }

      return updates
    })

    return NextResponse.json({ data: result }, { status: 200 })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.error('Update student error:', error)
    const message = error instanceof Error ? error.message : 'Failed to update student/subscription'
    const status = message.includes('not found') ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
