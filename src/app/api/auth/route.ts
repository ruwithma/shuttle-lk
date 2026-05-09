import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { phone, password } = body

    if (!phone || !password) {
      return NextResponse.json({ error: 'Phone and password are required' }, { status: 400 })
    }

    const user = await db.user.findUnique({
      where: { phone },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (user.password !== password) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
    }

    // Build response based on role
    const { password: _, ...userWithoutPassword } = user

    let associatedData = {}

    if (user.role === 'OWNER') {
      const ownedBuses = await db.bus.findMany({
        where: { ownerId: user.id },
        include: {
          driver: { select: { id: true, name: true, phone: true } },
          _count: { select: { subscriptions: true } },
        },
      })
      associatedData = { ownedBuses }
    } else if (user.role === 'DRIVER') {
      const assignedBus = await db.bus.findUnique({
        where: { driverId: user.id },
        include: {
          owner: { select: { id: true, name: true, phone: true } },
          _count: { select: { subscriptions: true } },
        },
      })
      associatedData = { assignedBus }
    } else if (user.role === 'STUDENT') {
      const subscriptions = await db.subscription.findMany({
        where: { studentId: user.id },
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
      associatedData = { subscriptions }
    }

    return NextResponse.json({
      user: userWithoutPassword,
      ...associatedData,
    }, { status: 200 })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.error('Auth error:', error)
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
  }
}
