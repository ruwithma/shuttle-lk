import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET - List buses
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const ownerId = searchParams.get('ownerId')

    const where: Record<string, unknown> = {}
    if (ownerId) {
      where.ownerId = ownerId
    }

    const buses = await db.bus.findMany({
      where,
      include: {
        owner: { select: { id: true, name: true, phone: true } },
        driver: { select: { id: true, name: true, phone: true } },
        _count: { select: { subscriptions: true, payments: true, expenses: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(buses, {
      status: 200,
      headers: { 'Cache-Control': 'private, max-age=30' },
    })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.error('Get buses error:', error)
    return NextResponse.json({ error: 'Failed to fetch buses' }, { status: 500 })
  }
}

// POST - Create bus
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { plateNumber, name, capacity, routeName, routeStart, routeEnd, routeStops, ownerId, driverId } = body

    if (!plateNumber || !name || !ownerId) {
      return NextResponse.json({ error: 'plateNumber, name, and ownerId are required' }, { status: 400 })
    }

    // Check if plate number already exists
    const existingBus = await db.bus.findFirst({ where: { plateNumber } })
    if (existingBus) {
      return NextResponse.json({ error: 'Bus with this plate number already exists' }, { status: 409 })
    }

    // If driverId provided, check driver is not already assigned
    if (driverId) {
      const driverBus = await db.bus.findFirst({ where: { driverId } })
      if (driverBus) {
        return NextResponse.json({ error: 'Driver is already assigned to another bus' }, { status: 409 })
      }
    }

    const bus = await db.bus.create({
      data: {
        plateNumber,
        name,
        capacity: capacity || 50,
        routeName: routeName || `${routeStart} - ${routeEnd}`,
        routeStart: routeStart || '',
        routeEnd: routeEnd || '',
        routeStops: routeStops || '',
        ownerId,
        driverId: driverId || null,
        active: true,
      },
      include: {
        owner: { select: { id: true, name: true, phone: true } },
        driver: { select: { id: true, name: true, phone: true } },
      },
    })

    return NextResponse.json({ bus }, { status: 201 })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.error('Create bus error:', error)
    return NextResponse.json({ error: 'Failed to create bus' }, { status: 500 })
  }
}

// PUT - Update bus
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: 'Bus id is required' }, { status: 400 })
    }

    const existingBus = await db.bus.findUnique({ where: { id } })
    if (!existingBus) {
      return NextResponse.json({ error: 'Bus not found' }, { status: 404 })
    }

    // Whitelist allowed fields
    const allowedFields = ['name', 'plateNumber', 'capacity', 'routeName', 'routeStart', 'routeEnd', 'routeStops', 'driverId'] as const
    const fieldsToUpdate: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        fieldsToUpdate[field] = body[field]
      }
    }

    // If updating driverId, check that driver is not already assigned to another bus
    if (fieldsToUpdate.driverId) {
      const driverBus = await db.bus.findFirst({ where: { driverId: fieldsToUpdate.driverId as string } })
      if (driverBus && driverBus.id !== id) {
        return NextResponse.json({ error: 'Driver is already assigned to another bus' }, { status: 409 })
      }
    }

    // If updating plateNumber, check uniqueness
    if (fieldsToUpdate.plateNumber && fieldsToUpdate.plateNumber !== existingBus.plateNumber) {
      const plateBus = await db.bus.findFirst({ where: { plateNumber: fieldsToUpdate.plateNumber as string } })
      if (plateBus) {
        return NextResponse.json({ error: 'Bus with this plate number already exists' }, { status: 409 })
      }
    }

    const bus = await db.bus.update({
      where: { id },
      data: fieldsToUpdate,
      include: {
        owner: { select: { id: true, name: true, phone: true } },
        driver: { select: { id: true, name: true, phone: true } },
      },
    })

    return NextResponse.json({ bus }, { status: 200 })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.error('Update bus error:', error)
    return NextResponse.json({ error: 'Failed to update bus' }, { status: 500 })
  }
}

// DELETE - Delete bus
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Bus id is required' }, { status: 400 })
    }

    const existingBus = await db.bus.findUnique({ where: { id } })
    if (!existingBus) {
      return NextResponse.json({ error: 'Bus not found' }, { status: 404 })
    }

    // Delete related records in transaction
    await db.$transaction(async (tx) => {
      // Delete payments for this bus
      await tx.payment.deleteMany({ where: { busId: id } })
      // Delete expenses for this bus
      await tx.expense.deleteMany({ where: { busId: id } })
      // Delete subscriptions for this bus
      await tx.subscription.deleteMany({ where: { busId: id } })
      // Delete bus locations for this bus
      await tx.busLocation.deleteMany({ where: { busId: id } })
      // Delete routes for this bus
      await tx.route.deleteMany({ where: { busId: id } })
      // Delete the bus
      await tx.bus.delete({ where: { id } })
    })

    return NextResponse.json({ message: 'Bus deleted successfully' }, { status: 200 })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.error('Delete bus error:', error)
    return NextResponse.json({ error: 'Failed to delete bus' }, { status: 500 })
  }
}
