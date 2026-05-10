import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET - List expenses with filters
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const busId = searchParams.get('busId')
    const category = searchParams.get('category')
    const month = searchParams.get('month')
    const ownerId = searchParams.get('ownerId')

    const where: Record<string, unknown> = {}

    if (category) where.category = category

    // Filter by owner's buses
    if (ownerId) {
      const ownedBuses = await db.bus.findMany({
        where: { ownerId },
        select: { id: true },
      })
      const busIds = ownedBuses.map(b => b.id)
      // If busId also provided, intersect: only include busId if it belongs to the owner
      if (busId) {
        where.busId = busIds.includes(busId) ? busId : '___none___'
      } else {
        where.busId = { in: busIds }
      }
    } else if (busId) {
      where.busId = busId
    }

    if (month) {
      // Parse month format "YYYY-MM"
      const [yearStr, monthStr] = month.split('-')
      const year = parseInt(yearStr)
      const monthNum = parseInt(monthStr) - 1
      const startDate = new Date(year, monthNum, 1)
      const endDate = new Date(year, monthNum + 1, 0, 23, 59, 59)
      where.date = { gte: startDate, lte: endDate }
    }

    const expenses = await db.expense.findMany({
      where,
      include: {
        bus: { select: { id: true, name: true, plateNumber: true } },
        recorder: { select: { id: true, name: true, role: true } },
      },
      orderBy: { date: 'desc' },
    })

    // Return flat array for frontend compatibility
    return NextResponse.json(expenses, { status: 200 })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.error('Get expenses error:', error)
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 })
  }
}

// POST - Create expense
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      busId,
      category,
      amount,
      description,
      date,
      recordedById,
    } = body

    if (!busId || !category || !amount || !recordedById) {
      return NextResponse.json(
        { error: 'busId, category, amount, and recordedById are required' },
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

    // Validate category
    const validCategories = ['FUEL', 'MAINTENANCE', 'SALARY', 'OTHER']
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate references
    const bus = await db.bus.findUnique({ where: { id: busId } })
    if (!bus) {
      return NextResponse.json({ error: 'Bus not found' }, { status: 404 })
    }

    const recorder = await db.user.findUnique({ where: { id: recordedById } })
    if (!recorder) {
      return NextResponse.json({ error: 'Recorder not found' }, { status: 404 })
    }

    const expense = await db.expense.create({
      data: {
        busId,
        category,
        amount: parseFloat(String(amount)),
        description: description || null,
        date: date ? new Date(date) : new Date(),
        recordedById,
      },
      include: {
        bus: { select: { id: true, name: true, plateNumber: true } },
        recorder: { select: { id: true, name: true, role: true } },
      },
    })

    return NextResponse.json(expense, { status: 201 })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.error('Create expense error:', error)
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 })
  }
}
