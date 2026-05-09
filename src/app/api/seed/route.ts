import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    // Check if data already exists
    const existingUsers = await db.user.count()
    if (existingUsers > 0) {
      return NextResponse.json({ message: 'Already seeded' }, { status: 200 })
    }

    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const result = await db.$transaction(async (tx) => {
      // === CREATE USERS ===
      const owner = await tx.user.create({
        data: {
          name: 'Chaminda Perera',
          phone: '0771234567',
          email: 'chaminda@shuttlelk.com',
          password: '123456',
          role: 'OWNER',
        },
      })

      const driverNimal = await tx.user.create({
        data: {
          name: 'Nimal Silva',
          phone: '0772345678',
          password: '123456',
          role: 'DRIVER',
        },
      })

      const driverSunil = await tx.user.create({
        data: {
          name: 'Sunil Fernando',
          phone: '0773456789',
          password: '123456',
          role: 'DRIVER',
        },
      })

      // === CREATE STUDENTS ===
      const studentData = [
        { name: 'Kavindi Rajapaksa', phone: '0712345001', paymentType: 'MONTHLY', monthlyAmount: 2500, dailyAmount: null },
        { name: 'Tharindu Jayawardena', phone: '0712345002', paymentType: 'DAILY', monthlyAmount: null, dailyAmount: 80 },
        { name: 'Sachini Wickramasinghe', phone: '0712345003', paymentType: 'MONTHLY', monthlyAmount: 2800, dailyAmount: null },
        { name: 'Pasindu Dias', phone: '0712345004', paymentType: 'DAILY', monthlyAmount: null, dailyAmount: 80 },
        { name: 'Nethmi Gunawardena', phone: '0712345005', paymentType: 'MONTHLY', monthlyAmount: 2500, dailyAmount: null },
        { name: 'Ruwan Bandara', phone: '0712345006', paymentType: 'DAILY', monthlyAmount: null, dailyAmount: 70 },
        { name: 'Dilini Samaraweera', phone: '0712345007', paymentType: 'MONTHLY', monthlyAmount: 3000, dailyAmount: null },
        { name: 'Chamara Wijesinghe', phone: '0712345008', paymentType: 'DAILY', monthlyAmount: null, dailyAmount: 80 },
        { name: 'Ishara Perera', phone: '0712345009', paymentType: 'MONTHLY', monthlyAmount: 2500, dailyAmount: null },
        { name: 'Lahiru Rathnayake', phone: '0712345010', paymentType: 'DAILY', monthlyAmount: null, dailyAmount: 70 },
        { name: 'Malini Fonseka', phone: '0712345011', paymentType: 'MONTHLY', monthlyAmount: 2800, dailyAmount: null },
        { name: 'Ashan De Silva', phone: '0712345012', paymentType: 'DAILY', monthlyAmount: null, dailyAmount: 80 },
      ]

      const students = []
      for (const sd of studentData) {
        const student = await tx.user.create({
          data: {
            name: sd.name,
            phone: sd.phone,
            password: '123456',
            role: 'STUDENT',
          },
        })
        students.push({ ...student, paymentType: sd.paymentType, monthlyAmount: sd.monthlyAmount, dailyAmount: sd.dailyAmount })
      }

      // === CREATE BUSES ===
      const busKadawatha = await tx.bus.create({
        data: {
          plateNumber: 'WP CAB-1234',
          name: 'Kadawatha Route',
          capacity: 52,
          routeName: 'Kadawatha - University of Kelaniya',
          routeStart: 'Kadawatha',
          routeEnd: 'University of Kelaniya',
          routeStops: 'Kadawatha Town,Mabola,Wattala,Kelaniya Bridge,University of Kelaniya',
          ownerId: owner.id,
          driverId: driverNimal.id,
          active: true,
        },
      })

      const busKiribathgoda = await tx.bus.create({
        data: {
          plateNumber: 'WP CAB-5678',
          name: 'Kiribathgoda Route',
          capacity: 48,
          routeName: 'Kiribathgoda - University of Kelaniya',
          routeStart: 'Kiribathgoda',
          routeEnd: 'University of Kelaniya',
          routeStops: 'Kiribathgoda Town,Kadawatha Road,Makola,Kelaniya,University of Kelaniya',
          ownerId: owner.id,
          driverId: driverSunil.id,
          active: true,
        },
      })

      // === CREATE SUBSCRIPTIONS ===
      // First 7 students on Kadawatha route, last 5 on Kiribathgoda route
      const subscriptions = []
      for (let i = 0; i < students.length; i++) {
        const s = students[i]
        const busId = i < 7 ? busKadawatha.id : busKiribathgoda.id
        const startDate = new Date(2025, 0, 1) // Jan 1, 2025

        const subscription = await tx.subscription.create({
          data: {
            studentId: s.id,
            busId: busId,
            paymentType: s.paymentType,
            monthlyAmount: s.monthlyAmount,
            dailyAmount: s.dailyAmount,
            startDate: startDate,
            active: true,
          },
        })
        subscriptions.push(subscription)
      }

      // === CREATE PAYMENTS ===
      // Monthly students - paid for current month (some paid, some not)
      const paymentEntries = []
      for (let i = 0; i < students.length; i++) {
        const s = students[i]
        const sub = subscriptions[i]
        const busId = i < 7 ? busKadawatha.id : busKiribathgoda.id
        const collectorId = i < 7 ? driverNimal.id : driverSunil.id

        if (s.paymentType === 'MONTHLY') {
          // Some monthly students have paid, some haven't (index 0, 2, 4 paid; 6, 8, 10 not paid)
          const hasPaid = [0, 2, 4].includes(i)
          if (hasPaid) {
            const payDate = new Date(now.getFullYear(), now.getMonth(), Math.min(now.getDate(), 5))
            paymentEntries.push({
              studentId: s.id,
              busId: busId,
              subscriptionId: sub.id,
              amount: s.monthlyAmount!,
              paymentMethod: i === 0 ? 'BANK_TRANSFER' : 'CASH',
              paymentType: 'MONTHLY',
              collectedById: collectorId,
              date: payDate,
              month: currentMonth,
              note: `Monthly payment for ${currentMonth}`,
            })
          }
        } else {
          // Daily students - create payments for some days this month
          const daysToPay = Math.min(now.getDate(), 10)
          for (let d = 1; d <= daysToPay; d++) {
            const dayDate = new Date(now.getFullYear(), now.getMonth(), d)
            // Skip weekends (Sat=6, Sun=0)
            const dayOfWeek = dayDate.getDay()
            if (dayOfWeek === 0 || dayOfWeek === 6) continue

            paymentEntries.push({
              studentId: s.id,
              busId: busId,
              subscriptionId: sub.id,
              amount: s.dailyAmount!,
              paymentMethod: d % 3 === 0 ? 'BANK_TRANSFER' : 'CASH',
              paymentType: 'DAILY',
              collectedById: collectorId,
              date: dayDate,
              note: `Daily fare - Day ${d}`,
            })
          }
        }
      }

      for (const pe of paymentEntries) {
        await tx.payment.create({ data: pe })
      }

      // === CREATE EXPENSES ===
      const expenseEntries = [
        { busId: busKadawatha.id, category: 'FUEL', amount: 15000, description: 'Diesel refill - full tank', date: new Date(now.getFullYear(), now.getMonth(), 1), recordedById: owner.id },
        { busId: busKadawatha.id, category: 'FUEL', amount: 12500, description: 'Diesel refill - mid month', date: new Date(now.getFullYear(), now.getMonth(), 15), recordedById: owner.id },
        { busId: busKadawatha.id, category: 'MAINTENANCE', amount: 5000, description: 'Oil change and filter replacement', date: new Date(now.getFullYear(), now.getMonth(), 5), recordedById: owner.id },
        { busId: busKadawatha.id, category: 'SALARY', amount: 35000, description: 'Driver salary - Nimal Silva', date: new Date(now.getFullYear(), now.getMonth(), 1), recordedById: owner.id },
        { busId: busKiribathgoda.id, category: 'FUEL', amount: 14000, description: 'Diesel refill - full tank', date: new Date(now.getFullYear(), now.getMonth(), 2), recordedById: owner.id },
        { busId: busKiribathgoda.id, category: 'FUEL', amount: 11000, description: 'Diesel refill - mid month', date: new Date(now.getFullYear(), now.getMonth(), 14), recordedById: owner.id },
        { busId: busKiribathgoda.id, category: 'MAINTENANCE', amount: 8500, description: 'Brake pad replacement', date: new Date(now.getFullYear(), now.getMonth(), 8), recordedById: owner.id },
        { busId: busKiribathgoda.id, category: 'SALARY', amount: 35000, description: 'Driver salary - Sunil Fernando', date: new Date(now.getFullYear(), now.getMonth(), 1), recordedById: owner.id },
        { busId: busKadawatha.id, category: 'OTHER', amount: 2000, description: 'Bus wash and cleaning', date: new Date(now.getFullYear(), now.getMonth(), 10), recordedById: owner.id },
        { busId: busKiribathgoda.id, category: 'OTHER', amount: 1500, description: 'Route permit renewal', date: new Date(now.getFullYear(), now.getMonth(), 12), recordedById: owner.id },
      ]

      for (const ee of expenseEntries) {
        await tx.expense.create({ data: ee })
      }

      // === CREATE NOTIFICATIONS ===
      const notificationEntries = [
        { userId: owner.id, title: 'Monthly Report Ready', message: 'Your monthly income and expense report for this month is ready to view.', type: 'GENERAL' },
        { userId: owner.id, title: 'Payment Collected', message: 'Kavindi Rajapaksa has paid LKR 2,500 for the monthly pass.', type: 'PAYMENT_RECEIVED' },
        // Notifications for unpaid monthly students
        { userId: students[6].id, title: 'Payment Reminder', message: 'Your monthly payment of LKR 3,000 for the Kadawatha Route is due. Please make the payment as soon as possible.', type: 'PAYMENT_REMINDER' },
        { userId: students[8].id, title: 'Payment Reminder', message: 'Your monthly payment of LKR 2,500 for the Kadawatha Route is due. Please make the payment as soon as possible.', type: 'PAYMENT_REMINDER' },
        { userId: students[10].id, title: 'Payment Reminder', message: 'Your monthly payment of LKR 2,800 for the Kiribathgoda Route is due. Please make the payment as soon as possible.', type: 'PAYMENT_REMINDER' },
        { userId: driverNimal.id, title: 'Route Update', message: 'There is a route detour near Kelaniya Bridge today due to road work. Please follow the alternative route.', type: 'GENERAL' },
        { userId: driverSunil.id, title: 'Maintenance Scheduled', message: 'Bus maintenance has been scheduled for next week. Please coordinate with the owner.', type: 'GENERAL' },
      ]

      for (const ne of notificationEntries) {
        await tx.notification.create({ data: ne })
      }

      return {
        users: { owner: 1, drivers: 2, students: 12 },
        buses: 2,
        subscriptions: subscriptions.length,
        payments: paymentEntries.length,
        expenses: expenseEntries.length,
        notifications: notificationEntries.length,
      }
    })

    return NextResponse.json({ message: 'Database seeded successfully', data: result }, { status: 201 })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json({ error: 'Failed to seed database', details: String(error) }, { status: 500 })
  }
}
