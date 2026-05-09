import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET - List notifications for a user
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const unreadOnly = searchParams.get('unreadOnly') === 'true'

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const where: Record<string, unknown> = { userId }
    if (unreadOnly) {
      where.read = false
    }

    const notifications = await db.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    const unreadCount = await db.notification.count({
      where: { userId, read: false },
    })

    return NextResponse.json({
      notifications,
      total: notifications.length,
      unreadCount,
    }, { status: 200, headers: { 'Cache-Control': 'private, max-age=15' } })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.error('Get notifications error:', error)
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
  }
}

// POST - Create notification OR send payment reminders
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Handle "send-reminders" action
    if (body.action === 'send-reminders') {
      return await sendPaymentReminders()
    }

    const { userId, title, message, type } = body

    if (!userId || !title || !message || !type) {
      return NextResponse.json(
        { error: 'userId, title, message, and type are required' },
        { status: 400 }
      )
    }

    // Validate type
    const validTypes = ['PAYMENT_REMINDER', 'PAYMENT_RECEIVED', 'GENERAL']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const notification = await db.notification.create({
      data: { userId, title, message, type },
    })

    return NextResponse.json({ notification }, { status: 201 })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.error('Create notification error:', error)
    return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 })
  }
}

// PUT - Mark notification(s) as read
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, userId } = body

    if (id) {
      // Mark single notification as read
      const notification = await db.notification.findUnique({ where: { id } })
      if (!notification) {
        return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
      }

      const updated = await db.notification.update({
        where: { id },
        data: { read: true },
      })

      return NextResponse.json({ notification: updated }, { status: 200 })
    }

    if (userId) {
      // Mark all notifications for a user as read
      const result = await db.notification.updateMany({
        where: { userId, read: false },
        data: { read: true },
      })

      return NextResponse.json({
        message: `${result.count} notifications marked as read`,
        count: result.count,
      }, { status: 200 })
    }

    return NextResponse.json({ error: 'id or userId is required' }, { status: 400 })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.error('Update notification error:', error)
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 })
  }
}

// Helper function to send payment reminders
async function sendPaymentReminders() {
  try {
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    // Find all active monthly subscriptions
    const monthlySubscriptions = await db.subscription.findMany({
      where: { paymentType: 'MONTHLY', active: true },
      include: {
        student: { select: { id: true, name: true } },
        bus: { select: { id: true, name: true } },
      },
    })

    const remindersSent: { studentId: string; studentName: string; busName: string }[] = []

    for (const sub of monthlySubscriptions) {
      // Check if student has paid for current month
      const payment = await db.payment.findFirst({
        where: {
          studentId: sub.studentId,
          busId: sub.busId,
          paymentType: 'MONTHLY',
          month: currentMonth,
        },
      })

      if (!payment) {
        // Check if reminder already sent recently (within last 3 days)
        const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
        const recentReminder = await db.notification.findFirst({
          where: {
            userId: sub.studentId,
            type: 'PAYMENT_REMINDER',
            createdAt: { gte: threeDaysAgo },
          },
        })

        if (!recentReminder) {
          const amount = sub.monthlyAmount ? `LKR ${sub.monthlyAmount.toLocaleString()}` : 'the monthly amount'
          await db.notification.create({
            data: {
              userId: sub.studentId,
              title: 'Payment Reminder',
              message: `Your monthly payment of ${amount} for ${sub.bus.name} is due for ${currentMonth}. Please make the payment as soon as possible.`,
              type: 'PAYMENT_REMINDER',
            },
          })

          remindersSent.push({
            studentId: sub.studentId,
            studentName: sub.student.name,
            busName: sub.bus.name,
          })
        }
      }
    }

    return NextResponse.json({
      message: `${remindersSent.length} payment reminders sent`,
      remindersSent,
    }, { status: 200 })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.error('Send reminders error:', error)
    return NextResponse.json({ error: 'Failed to send payment reminders' }, { status: 500 })
  }
}
