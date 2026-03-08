import cron from "node-cron";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * Her sabah 07:00'de personellere günlük plan bildirimi gönderir.
 * Export edildi ki test amaçlı elle de çağrılabilsin.
 */
export async function sendDailyPlanNotifications() {
    try {
        // Bugünün TR başlangıç ve bitişi
        const now = new Date();
        const todayStart = new Date(now.toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" }) + "T00:00:00+03:00");
        const todayEnd = new Date(now.toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" }) + "T23:59:59+03:00");

        const events = await prisma.scheduleEvent.findMany({
            where: {
                start: { gte: todayStart, lte: todayEnd },
                status: { not: "CANCELLED" },
            },
            include: { store: { select: { name: true, code: true } } },
            orderBy: { start: "asc" },
        });

        if (!events.length) {
            console.log("[CRON] Bugün planlanmış ziyaret yok, bildirim gönderilmedi.");
            return;
        }

        // employeeId'ye göre grupla
        const grouped = {};
        for (const ev of events) {
            if (!ev.employeeId) continue;
            if (!grouped[ev.employeeId]) grouped[ev.employeeId] = [];
            grouped[ev.employeeId].push(ev);
        }

        const trDate = todayStart.toLocaleDateString("tr-TR", {
            weekday: "long", day: "2-digit", month: "long", year: "numeric",
            timeZone: "Europe/Istanbul",
        });

        let count = 0;
        for (const [empIdStr, empEvents] of Object.entries(grouped)) {
            const empId = Number(empIdStr);
            const summary = empEvents.map((ev) => {
                const saat = new Date(ev.start).toLocaleTimeString("tr-TR", {
                    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul",
                });
                const storeName = ev.store?.name || `Mağaza #${ev.storeId}`;
                return `${storeName} (${saat})`;
            }).join(", ");

            await prisma.notification.create({
                data: {
                    type: "DAILY_PLAN",
                    title: `Günlük Plan — ${trDate}`,
                    body: `Bugün ${empEvents.length} ziyaretiniz var: ${summary}`,
                    link: "/calendar",
                    recipientRole: "EMPLOYEE",
                    recipientId: empId,
                },
            });
            count++;
        }
        console.log(`[CRON] ${count} personele günlük plan bildirimi gönderildi.`);
    } catch (err) {
        console.error("[CRON] Daily plan notification error:", err);
    }
}

/**
 * Initializes all system cron jobs.
 */
export function initCronJobs() {
    console.log("Initializing Cron Jobs...");

    // Daily Plan Notifications at 07:00 AM (Turkey time)
    cron.schedule("0 7 * * *", async () => {
        console.log("[CRON] Running daily employee plan notifications...");
        await sendDailyPlanNotifications();
    }, { timezone: "Europe/Istanbul" });

    console.log("Cron jobs scheduled: Daily Plan Notifications (07:00 TR)");
}
