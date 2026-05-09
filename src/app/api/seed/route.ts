import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// ── OSRM Routing Helper ──────────────────────────────────────────────────

async function getOSRMRoute(waypoints: [number, number][]): Promise<[number, number][] | null> {
  if (waypoints.length < 2) return null

  const coordsStr = waypoints
    .map(([lat, lng]) => `${lng},${lat}`)
    .join(';')

  const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'ShuttleLK/1.0' },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) return null

    const data = await response.json()
    if (data.code !== 'Ok' || !data.routes?.length) return null

    const route = data.routes[0]
    const coords: [number, number][] = route.geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng]
    )

    // Simplify to ~80 points
    if (coords.length > 80) {
      const step = Math.max(1, Math.floor(coords.length / 80))
      const simplified: [number, number][] = []
      for (let i = 0; i < coords.length; i += step) {
        simplified.push(coords[i])
      }
      if (simplified[simplified.length - 1][0] !== coords[coords.length - 1][0] ||
          simplified[simplified.length - 1][1] !== coords[coords.length - 1][1]) {
        simplified.push(coords[coords.length - 1])
      }
      return simplified
    }

    return coords
  } catch {
    return null
  }
}

// ── Fallback linear-interpolated coordinates ─────────────────────────────

const kadawathaFallback: [number, number][] = [
  [6.9350,79.8485], [6.9358,79.8498], [6.9368,79.8512], [6.9380,79.8525],
  [6.9395,79.8545], [6.9410,79.8568], [6.9428,79.8590], [6.9445,79.8612],
  [6.9462,79.8635], [6.9480,79.8658], [6.9495,79.8675], [6.9510,79.8692],
  [6.9528,79.8710], [6.9545,79.8730], [6.9560,79.8748], [6.9578,79.8765],
  [6.9595,79.8782], [6.9612,79.8800], [6.9630,79.8818], [6.9645,79.8835],
  [6.9660,79.8850], [6.9678,79.8865], [6.9695,79.8880], [6.9710,79.8898],
  [6.9725,79.8915], [6.9740,79.8932], [6.9750,79.8950], [6.9755,79.8970],
  [6.9758,79.8990], [6.9760,79.9010], [6.9750,79.9030],
]

const kiribathgodaFallback: [number, number][] = [
  [6.9770,79.8930], [6.9772,79.8945], [6.9775,79.8960], [6.9778,79.8975],
  [6.9782,79.8990], [6.9788,79.9000], [6.9795,79.9008], [6.9802,79.9015],
  [6.9808,79.9020], [6.9805,79.9025], [6.9800,79.9028], [6.9795,79.9030],
  [6.9790,79.9032], [6.9785,79.9033], [6.9780,79.9032], [6.9775,79.9030],
  [6.9770,79.9028], [6.9765,79.9028], [6.9760,79.9030], [6.9755,79.9032],
  [6.9750,79.9030],
]

const colomboFortFallback: [number, number][] = [
  [6.9335,79.8468], [6.9340,79.8475], [6.9345,79.8485], [6.9350,79.8498],
  [6.9360,79.8515], [6.9368,79.8535], [6.9375,79.8555], [6.9380,79.8575],
  [6.9385,79.8595], [6.9390,79.8615], [6.9395,79.8635], [6.9400,79.8655],
  [6.9405,79.8675], [6.9410,79.8695], [6.9415,79.8715], [6.9420,79.8735],
  [6.9425,79.8755], [6.9430,79.8775], [6.9435,79.8795], [6.9445,79.8812],
  [6.9460,79.8830], [6.9478,79.8848], [6.9495,79.8865], [6.9512,79.8882],
  [6.9530,79.8900], [6.9548,79.8918], [6.9565,79.8935], [6.9582,79.8952],
  [6.9600,79.8970], [6.9620,79.8988], [6.9640,79.9002], [6.9660,79.9012],
  [6.9680,79.9020], [6.9700,79.9028], [6.9725,79.9032], [6.9750,79.9030],
]

// ── Key waypoints for OSRM routing ───────────────────────────────────────

const kadawathaWaypoints: [number, number][] = [
  [6.9350, 79.8485], // Kadawatha Town
  [6.9480, 79.8658], // Mabola
  [6.9630, 79.8818], // Wattala
  [6.9710, 79.8898], // Kelaniya Bridge
  [6.9750, 79.9030], // University of Kelaniya
]

const kiribathgodaWaypoints: [number, number][] = [
  [6.9770, 79.8930], // Kiribathgoda Town
  [6.9782, 79.8990], // Kadawatha Road
  [6.9802, 79.9015], // Makola
  [6.9785, 79.9033], // Kelaniya
  [6.9750, 79.9030], // University of Kelaniya
]

const colomboFortWaypoints: [number, number][] = [
  [6.9335, 79.8468], // Colombo Fort
  [6.9370, 79.8510], // Pettah
  [6.9385, 79.8620], // Maradana
  [6.9405, 79.8720], // Dematagoda
  [6.9720, 79.9020], // Kelaniya
  [6.9750, 79.9030], // University of Kelaniya
]

// ── Seed handler ─────────────────────────────────────────────────────────

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

    // ── Get road-following routes from OSRM (with fallback) ────────────────
    console.log('Fetching road-following routes from OSRM...')

    const [kadawathaOSRM, kiribathgodaOSRM, colomboFortOSRM] = await Promise.all([
      getOSRMRoute(kadawathaWaypoints),
      getOSRMRoute(kiribathgodaWaypoints),
      getOSRMRoute(colomboFortWaypoints),
    ])

    const kadawathaRouteCoords: [number, number][] = kadawathaOSRM ?? kadawathaFallback
    const kiribathgodaRouteCoords: [number, number][] = kiribathgodaOSRM ?? kiribathgodaFallback
    const colomboFortRouteCoords: [number, number][] = colomboFortOSRM ?? colomboFortFallback

    console.log(`OSRM routes: Kadawatha=${kadawathaRouteCoords.length}pts${kadawathaOSRM ? ' (OSRM)' : ' (fallback)'}, Kiribathgoda=${kiribathgodaRouteCoords.length}pts${kiribathgodaOSRM ? ' (OSRM)' : ' (fallback)'}, ColomboFort=${colomboFortRouteCoords.length}pts${colomboFortOSRM ? ' (OSRM)' : ' (fallback)'}`)

    // ── Route stops ────────────────────────────────────────────────────────

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

    // Colombo Fort Route stops with estimated minutes
    const colomboFortStops = [
      { name: 'Colombo Fort', lat: 6.9335, lng: 79.8468, order: 1, estimatedMinutes: 0 },
      { name: 'Pettah', lat: 6.9370, lng: 79.8510, order: 2, estimatedMinutes: 5 },
      { name: 'Maradana', lat: 6.9385, lng: 79.8620, order: 3, estimatedMinutes: 12 },
      { name: 'Dematagoda', lat: 6.9405, lng: 79.8720, order: 4, estimatedMinutes: 18 },
      { name: 'Kelaniya', lat: 6.9720, lng: 79.9020, order: 5, estimatedMinutes: 30 },
      { name: 'University of Kelaniya', lat: 6.9750, lng: 79.9030, order: 6, estimatedMinutes: 35 },
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
    const colomboFortDistance = calculateDistance(colomboFortRouteCoords)

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

      const driverKamal = await tx.user.create({
        data: {
          name: 'Kamal Jayasuriya',
          phone: '0774567890',
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
        // Students for Colombo Fort route
        { name: 'Samanthi Herath', phone: '0712345013', paymentType: 'MONTHLY', monthlyAmount: 3500, dailyAmount: null },
        { name: 'Dinesh Kumara', phone: '0712345014', paymentType: 'DAILY', monthlyAmount: null, dailyAmount: 100 },
        { name: 'Thilini Weerasinghe', phone: '0712345015', paymentType: 'MONTHLY', monthlyAmount: 3200, dailyAmount: null },
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

      const busColomboFort = await tx.bus.create({
        data: {
          plateNumber: 'WP CAB-9012',
          name: 'Colombo Fort Route',
          capacity: 56,
          routeName: 'Colombo Fort - University of Kelaniya',
          routeStart: 'Colombo Fort',
          routeEnd: 'University of Kelaniya',
          routeStops: 'Colombo Fort,Pettah,Maradana,Dematagoda,Kelaniya,University of Kelaniya',
          routeCoordinates: JSON.stringify(colomboFortRouteCoords),
          routeStopCoordinates: JSON.stringify({
            'Colombo Fort': [6.9335, 79.8468],
            'Pettah': [6.9370, 79.8510],
            'Maradana': [6.9385, 79.8620],
            'Dematagoda': [6.9405, 79.8720],
            'Kelaniya': [6.9720, 79.9020],
            'University of Kelaniya': [6.9750, 79.9030],
          }),
          currentLat: 6.9385,
          currentLng: 79.8620,
          ownerId: owner.id,
          driverId: driverKamal.id,
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

      // Colombo Fort Forward Route
      await tx.route.create({
        data: {
          busId: busColomboFort.id,
          name: 'Colombo Fort - University of Kelaniya',
          direction: 'forward',
          coordinates: JSON.stringify(colomboFortRouteCoords.map(([lat, lng]) => [lng, lat])),
          stops: JSON.stringify(colomboFortStops),
          totalDistance: colomboFortDistance,
          estimatedDuration: 35,
          isActive: true,
        },
      })

      // Colombo Fort Return Route
      await tx.route.create({
        data: {
          busId: busColomboFort.id,
          name: 'University of Kelaniya - Colombo Fort',
          direction: 'return',
          coordinates: JSON.stringify([...colomboFortRouteCoords].reverse().map(([lat, lng]) => [lng, lat])),
          stops: JSON.stringify([...colomboFortStops].reverse().map((s, i) => ({
            ...s,
            order: i + 1,
            estimatedMinutes: 35 - s.estimatedMinutes,
          }))),
          totalDistance: colomboFortDistance,
          estimatedDuration: 35,
          isActive: true,
        },
      })

      // === CREATE SUBSCRIPTIONS ===
      const subscriptions = []
      for (let i = 0; i < students.length; i++) {
        const s = students[i]
        // First 7 students → Kadawatha, next 5 → Kiribathgoda, last 3 → Colombo Fort
        let busId: string
        if (i < 7) {
          busId = busKadawatha.id
        } else if (i < 12) {
          busId = busKiribathgoda.id
        } else {
          busId = busColomboFort.id
        }
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
        // First 7 students → Kadawatha (Nimal), next 5 → Kiribathgoda (Sunil), last 3 → Colombo Fort (Kamal)
        let busId: string
        let collectorId: string
        if (i < 7) {
          busId = busKadawatha.id
          collectorId = driverNimal.id
        } else if (i < 12) {
          busId = busKiribathgoda.id
          collectorId = driverSunil.id
        } else {
          busId = busColomboFort.id
          collectorId = driverKamal.id
        }

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
        { busId: busColomboFort.id, category: 'FUEL', amount: 16000, description: 'Diesel refill - full tank', date: new Date(now.getFullYear(), now.getMonth(), 1), recordedById: owner.id },
        { busId: busColomboFort.id, category: 'FUEL', amount: 13000, description: 'Diesel refill - mid month', date: new Date(now.getFullYear(), now.getMonth(), 13), recordedById: owner.id },
        { busId: busColomboFort.id, category: 'MAINTENANCE', amount: 4500, description: 'Tire rotation and alignment', date: new Date(now.getFullYear(), now.getMonth(), 7), recordedById: owner.id },
        { busId: busColomboFort.id, category: 'SALARY', amount: 38000, description: 'Driver salary - Kamal Jayasuriya', date: new Date(now.getFullYear(), now.getMonth(), 1), recordedById: owner.id },
        { busId: busKadawatha.id, category: 'OTHER', amount: 2000, description: 'Bus wash and cleaning', date: new Date(now.getFullYear(), now.getMonth(), 10), recordedById: owner.id },
        { busId: busKiribathgoda.id, category: 'OTHER', amount: 1500, description: 'Route permit renewal', date: new Date(now.getFullYear(), now.getMonth(), 12), recordedById: owner.id },
        { busId: busColomboFort.id, category: 'OTHER', amount: 1800, description: 'Interior cleaning and sanitization', date: new Date(now.getFullYear(), now.getMonth(), 9), recordedById: owner.id },
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
        { userId: students[12].id, title: 'Payment Reminder', message: 'Your monthly payment of LKR 3,500 for the Colombo Fort Route is due. Please make the payment as soon as possible.', type: 'PAYMENT_REMINDER' },
        { userId: driverNimal.id, title: 'Route Update', message: 'There is a route detour near Kelaniya Bridge today due to road work. Please follow the alternative route.', type: 'GENERAL' },
        { userId: driverSunil.id, title: 'Maintenance Scheduled', message: 'Bus maintenance has been scheduled for next week. Please coordinate with the owner.', type: 'GENERAL' },
        { userId: driverKamal.id, title: 'New Route Assigned', message: 'You have been assigned to the Colombo Fort - University of Kelaniya route. Please review the stops and schedule.', type: 'GENERAL' },
      ]

      for (const ne of notificationEntries) {
        await tx.notification.create({ data: ne })
      }

      return {
        users: { owner: 1, drivers: 3, students: 15 },
        buses: 3,
        routes: 6,
        subscriptions: subscriptions.length,
        payments: paymentEntries.length,
        expenses: expenseEntries.length,
        notifications: notificationEntries.length,
        routing: {
          kadawatha: { points: kadawathaRouteCoords.length, source: kadawathaOSRM ? 'osrm' : 'fallback' },
          kiribathgoda: { points: kiribathgodaRouteCoords.length, source: kiribathgodaOSRM ? 'osrm' : 'fallback' },
          colomboFort: { points: colomboFortRouteCoords.length, source: colomboFortOSRM ? 'osrm' : 'fallback' },
        },
      }
    })

    return NextResponse.json({ message: 'Database seeded successfully', data: result }, { status: 201 })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.error('Seed error:', error)
    return NextResponse.json({ error: 'Failed to seed database', details: String(error) }, { status: 500 })
  }
}
