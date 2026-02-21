// scripts/seed-tracking.js
// Mock tracking verileri oluşturur — 3 gün × mevcut çalışanlar
// Kullanım: node scripts/seed-tracking.js

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/* ────── Sabitler ────── */

// İstanbul merkezli rastgele rota üreteci
const ISTANBUL_CENTER = { lat: 41.015, lng: 28.98 };
const ANKARA_CENTER = { lat: 39.925, lng: 32.85 };
const IZMIR_CENTER = { lat: 38.42, lng: 27.14 };

const CITIES = [ISTANBUL_CENTER, ANKARA_CENTER, IZMIR_CENTER];

// Bir günlük rota: sabah 08:00 → akşam 18:00 arası, ~60 sn aralıklarla
const WORK_START_HOUR = 8;
const WORK_END_HOUR = 18;
const INTERVAL_SEC = 60; // her 60 saniyede bir nokta

function randomBetween(min, max) {
    return min + Math.random() * (max - min);
}

// Rastgele bir yürüyüş rotası üretir (random walk)
function generateDayRoute(center, date) {
    const points = [];
    let lat = center.lat + randomBetween(-0.02, 0.02);
    let lng = center.lng + randomBetween(-0.02, 0.02);

    const dayStart = new Date(date);
    dayStart.setHours(WORK_START_HOUR, 0, 0, 0);

    const dayEnd = new Date(date);
    dayEnd.setHours(WORK_END_HOUR, 0, 0, 0);

    let t = dayStart.getTime();
    const endT = dayEnd.getTime();

    while (t < endT) {
        // Rastgele hareket (50-300m arası)
        const angle = Math.random() * 2 * Math.PI;
        const dist = randomBetween(0.0003, 0.002); // ~30m-200m
        lat += Math.sin(angle) * dist;
        lng += Math.cos(angle) * dist;

        // Bazen dur (ofis/mağaza ziyareti simülasyonu)
        const isPause = Math.random() < 0.15;
        const step = isPause
            ? INTERVAL_SEC * randomBetween(3, 10) // 3-10 dakika durma
            : INTERVAL_SEC * randomBetween(0.8, 1.5);

        points.push({
            lat: parseFloat(lat.toFixed(7)),
            lng: parseFloat(lng.toFixed(7)),
            accuracy: Math.round(randomBetween(5, 50)),
            speed: isPause ? 0 : parseFloat(randomBetween(0.5, 15).toFixed(1)),
            heading: parseFloat((Math.random() * 360).toFixed(1)),
            source: "mock-seed",
            at: new Date(t),
        });

        t += step * 1000;
    }

    return points;
}

async function main() {
    console.log("🗑️  Mevcut mock verileri temizleniyor...");
    await prisma.employeeTrackPoint.deleteMany({
        where: { source: "mock-seed" },
    });

    // Çalışanları al
    const employees = await prisma.employee.findMany({
        select: { id: true, fullName: true },
    });

    if (employees.length === 0) {
        console.log("⚠️  Hiç çalışan bulunamadı. Önce çalışan ekleyin.");
        return;
    }

    console.log(`👥 ${employees.length} çalışan bulundu.`);

    const today = new Date();
    const days = [];
    for (let i = 0; i < 3; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        days.push(d);
    }

    let totalPoints = 0;

    for (const emp of employees) {
        // Her çalışana rastgele bir şehir ata
        const city = CITIES[emp.id % CITIES.length];

        for (const day of days) {
            const dayStr = day.toISOString().slice(0, 10);
            const points = generateDayRoute(city, day);

            // Toplu ekle
            await prisma.employeeTrackPoint.createMany({
                data: points.map((p) => ({
                    employeeId: emp.id,
                    ...p,
                })),
            });

            totalPoints += points.length;
            console.log(`  📍 ${emp.fullName} — ${dayStr}: ${points.length} nokta (${city === ISTANBUL_CENTER ? "İstanbul" : city === ANKARA_CENTER ? "Ankara" : "İzmir"})`);
        }
    }

    console.log(`\n✅ Toplam ${totalPoints} tracking noktası oluşturuldu (${employees.length} çalışan × ${days.length} gün)`);
}

main()
    .catch((e) => {
        console.error("❌ Hata:", e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
