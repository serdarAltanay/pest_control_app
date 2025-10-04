import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { auth, roleCheck } from "../middleware/auth.js";

const router = Router();
const prisma = new PrismaClient();

const ONLINE_MS = 2 * 60 * 1000;
const IDLE_MS   = 10 * 60 * 1000;

// Basit heartbeat — her çağrıda lastSeenAt güncellenir
router.post("/heartbeat", auth, async (req, res) => {
  try {
    const { role, id } = req.user; // token’dan geliyor
    const now = new Date();

    if (role === "admin") {
      await prisma.admin.update({ where: { id }, data: { lastSeenAt: now } });
    } else if (role === "employee") {
      await prisma.employee.update({ where: { id }, data: { lastSeenAt: now } });
    } else if (role === "customer") {
      await prisma.customer.update({ where: { id }, data: { lastSeenAt: now } });
    }

    return res.status(204).end(); // ÖNEMLİ: body yok
  } catch (e) {
    // Heartbeat hata verse bile sessiz kalalım
    return res.status(204).end();
  }
});

router.get("/summary", auth, roleCheck(["admin"]), async (_req, res) => {
  try {
    const now = Date.now();
    const onlineThreshold = new Date(now - ONLINE_MS);
    const idleThreshold   = new Date(now - IDLE_MS);

    const [admins, employees, customers] = await Promise.all([
      prisma.admin.findMany({ select: { lastSeenAt: true } }),
      prisma.employee.findMany({ select: { lastSeenAt: true } }),
      prisma.customer.findMany({ select: { lastSeenAt: true } }),
    ]);

    const bucket = (items) => {
      let online = 0, idle = 0, offline = 0;
      for (const it of items) {
        const t = it.lastSeenAt;
        if (!t) { offline++; continue; }
        if (t >= onlineThreshold) online++;
        else if (t >= idleThreshold) idle++;
        else offline++;
      }
      return { online, idle, offline, total: items.length };
    };

    res.json({
      admins: bucket(admins),
      employees: bucket(employees),
      customers: bucket(customers),
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("GET /presence/summary error:", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

export default router;
