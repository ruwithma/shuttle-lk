import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // Check if force re-seed is requested
    const { searchParams } = new URL(request.url)
    const force = searchParams.get('force')

    // Check if data already exists
    const existingUsers = await db.user.count()
    if (existingUsers > 0 && force !== 'true') {
      return NextResponse.json({ message: 'Already seeded. Use ?force=true to re-seed.' }, { status: 200 })
    }

    // If force re-seed, delete all existing data
    if (existingUsers > 0 && force === 'true') {
      await db.$transaction(async (tx) => {
        await tx.notification.deleteMany()
        await tx.payment.deleteMany()
        await tx.expense.deleteMany()
        await tx.subscription.deleteMany()
        await tx.busLocation.deleteMany()
        await tx.route.deleteMany()
        await tx.bus.deleteMany()
        await tx.user.deleteMany()
      })
    }

    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    // ── Detailed route coordinates ──────────────────────────────────────────

    // Kadawatha → University of Kelaniya (31 points along actual roads)
    const kadawathaRouteCoords: [number, number][] = [
      [6.9350,79.8485], [6.9358,79.8498], [6.9368,79.8512], [6.9380,79.8525],
      [6.9395,79.8545], [6.9410,79.8568], [6.9428,79.8590], [6.9445,79.8612],
      [6.9462,79.8635], [6.9480,79.8658], [6.9495,79.8675], [6.9510,79.8692],
      [6.9528,79.8710], [6.9545,79.8730], [6.9560,79.8748], [6.9578,79.8765],
      [6.9595,79.8782], [6.9612,79.8800], [6.9630,79.8818], [6.9645,79.8835],
      [6.9660,79.8850], [6.9678,79.8865], [6.9695,79.8880], [6.9710,79.8898],
      [6.9725,79.8915], [6.9740,79.8932], [6.9750,79.8950], [6.9755,79.8970],
      [6.9758,79.8990], [6.9760,79.9010], [6.9750,79.9030],
    ]

    // Kiribathgoda → University of Kelaniya (21 points along actual roads)
    const kiribathgodaRouteCoords: [number, number][] = [
      [6.9770,79.8930], [6.9772,79.8945], [6.9775,79.8960], [6.9778,79.8975],
      [6.9782,79.8990], [6.9788,79.9000], [6.9795,79.9008], [6.9802,79.9015],
      [6.9808,79.9020], [6.9805,79.9025], [6.9800,79.9028], [6.9795,79.9030],
      [6.9790,79.9032], [6.9785,79.9033], [6.9780,79.9032], [6.9775,79.9030],
      [6.9770,79.9028], [6.9765,79.9028], [6.9760,79.9030], [6.9755,79.9032],
      [6.9750,79.9030],
    ]

    // Kadawatha Route stops with estimated minutes
    const kadawathaStops = [
      { name: 'Kadawatha Town', lat: 6.9350, lng: 79.8485, order: 1, estimatedMinutes: 0 },
      { name: 'Mabola', lat: 6.9480, lng: 79.8658, order: 2, estimatedMinutes: 8 },
      { name: 'Wattala', lat: 6.9630, lng: 79.8818, order: 3, estimatedMinutes: 16 },
      { name: 'Kelaniya Bridge', lat: 6.9710, lng: 79.8898, order: 4, estimatedMinutes: 22 },
      { name: 'University of Kelaniya', lat: 6.9750, lng: 79.9030, order: 5, estimatedMinutes: 28 },
    ]

    // Kiribathgoda Route stops with estimated minutes
    const kiribathgodaStops = [
      { name: 'Kiribathgoda Town', lat: 6.9770, lng: 79.8930, order: 1, estimatedMinutes: 0 },
      { name: 'Kadawatha Road', lat: 6.9782, lng: 79.8990, order: 2, estimatedMinutes: 5 },
      { name: 'Makola', lat: 6.9802, lng: 79.9015, order: 3, estimatedMinutes: 10 },
      { name: 'Kelaniya', lat: 6.9785, lng: 79.9033, order: 4, estimatedMinutes: 15 },
      { name: 'University of Kelaniya', lat: 6.9750, lng: 79.9030, order: 5, estimatedMinutes: 20 },
    ]

    // Calculate total distance using Haversine for each route
    function calculateDistance(coords: [number, number][]): number {
      let total = 0
      for (let i = 1; i < coords.length; i++) {
        const [lat1, lng1] = coords[i - 1]
        const [lat2, lng2] = coords[i]
        const R = 6371000
        const dLat = (lat2 - lat1) * Math.PI / 180
        const dLng = (lng2 - lng1) * Math.PI / 180
        const a = Math.sin(dLat / 2) ** 2 +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLng / 2) ** 2
        total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      }
      return total
    }

    const kadawathaDistance = calculateDistance(kadawathaRouteCoords)
    const kiribathgodaDistance = calculateDistance(kiribathgodaRouteCoords)

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

      // === CREATE BUSES with detailed route coordinates ===
      const busKadawatha = await tx.bus.create({
        data: {
          plateNumber: 'WP CAB-1234',
          name: 'Kadawatha Route',
          capacity: 52,
          routeName: 'Kadawatha - University of Kelaniya',
          routeStart: 'Kadawatha',
          routeEnd: 'University of Kelaniya',
          routeStops: 'Kadawatha Town,Mabola,Wattala,Kelaniya Bridge,University of Kelaniya',
          routeCoordinates: JSON.stringify(kadawathaRouteCoords),
          routeStopCoordinates: JSON.stringify({
            'Kadawatha Town': [6.9350, 79.8485],
            'Mabola': [6.9480, 79.8658],
            'Wattala': [6.9630, 79.8818],
            'Kelaniya Bridge': [6.9710, 79.8898],
            'University of Kelaniya': [6.9750, 79.9030],
          }),
          currentLat: 6.9480,
          currentLng: 79.8658,
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
          routeCoordinates: JSON.stringify(kiribathgodaRouteCoords),
          routeStopCoordinates: JSON.stringify({
            'Kiribathgoda Town': [6.9770, 79.8930],
            'Kadawatha Road': [6.9782, 79.8990],
            'Makola': [6.9802, 79.9015],
            'Kelaniya': [6.9785, 79.9033],
            'University of Kelaniya': [6.9750, 79.9030],
          }),
          currentLat: 6.9790,
          currentLng: 79.8980,
          ownerId: owner.id,
          driverId: driverSunil.id,
          active: true,
        },
      })

      // === CREATE ROUTE RECORDS (with stops that have estimatedMinutes) ===

      // Kadawatha Forward Route
      await tx.route.create({
        data: {
          busId: busKadawatha.id,
          name: 'Kadawatha - University of Kelaniya',
          direction: 'forward',
          coordinates: JSON.stringify(kadawathaRouteCoords.map(([lat, lng]) => [lng, lat])), // MapLibre [lng, lat] order
          stops: JSON.stringify(kadawathaStops),
          totalDistance: kadawathaDistance,
          estimatedDuration: 28,
          isActive: true,
        },
      })

      // Kadawatha Return Route
      await tx.route.create({
        data: {
          busId: busKadawatha.id,
          name: 'University of Kelaniya - Kadawatha',
          direction: 'return',
          coordinates: JSON.stringify([...kadawathaRouteCoords].reverse().map(([lat, lng]) => [lng, lat])),
          stops: JSON.stringify([...kadawathaStops].reverse().map((s, i) => ({
            ...s,
            order: i + 1,
            estimatedMinutes: 28 - s.estimatedMinutes,
          }))),
          totalDistance: kadawathaDistance,
          estimatedDuration: 28,
          isActive: true,
        },
      })

      // Kiribathgoda Forward Route
      await tx.route.create({
        data: {
          busId: busKiribathgoda.id,
          name: 'Kiribathgoda - University of Kelaniya',
          direction: 'forward',
          coordinates: JSON.stringify(kiribathgodaRouteCoords.map(([lat, lng]) => [lng, lat])),
          stops: JSON.stringify(kiribathgodaStops),
          totalDistance: kiribathgodaDistance,
          estimatedDuration: 20,
          isActive: true,
        },
      })

      // Kiribathgoda Return Route
      await tx.route.create({
        data: {
          busId: busKiribathgoda.id,
          name: 'University of Kelaniya - Kiribathgoda',
          direction: 'return',
          coordinates: JSON.stringify([...kiribathgodaRouteCoords].reverse().map(([lat, lng]) => [lng, lat])),
          stops: JSON.stringify([...kiribathgodaStops].reverse().map((s, i) => ({
            ...s,
            order: i + 1,
            estimatedMinutes: 20 - s.estimatedMinutes,
          }))),
          totalDistance: kiribathgodaDistance,
          estimatedDuration: 20,
          isActive: true,
        },
      })

      // === CREATE SUBSCRIPTIONS ===
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
      const paymentEntries = []
      for (let i = 0; i < students.length; i++) {
        const s = students[i]
        const sub = subscriptions[i]
        const busId = i < 7 ? busKadawatha.id : busKiribathgoda.id
        const collectorId = i < 7 ? driverNimal.id : driverSunil.id

        if (s.paymentType === 'MONTHLY') {
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
          const daysToPay = Math.min(now.getDate(), 10)
          for (let d = 1; d <= daysToPay; d++) {
            const dayDate = new Date(now.getFullYear(), now.getMonth(), d)
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
        routes: 4,
        subscriptions: subscriptions.length,
        payments: paymentEntries.length,
        expenses: expenseEntries.length,
        notifications: notificationEntries.length,
        kadawathaRoutePoints: kadawathaRouteCoords.length,
        kiribathgodaRoutePoints: kiribathgodaRouteCoords.length,
      }
    })

    return NextResponse.json({ message: 'Database seeded successfully', data: result }, { status: 201 })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.error('Seed error:', error)
    return NextResponse.json({ error: 'Failed to seed database', details: String(error) }, { status: 500 })
  }
}
