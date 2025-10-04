// routes/online.js
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { auth, roleCheck } from "../middleware/auth.js";

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/online/summary?thresholdMs=120000
 * - Sadece admin
 * - lastSeenAt >= now - thresholdMs => online
 */
router.get("/summary", auth, roleCheck(["admin"]), async (req, res) => {
  try {
    const thresholdMs = Number(req.query.thresholdMs || 120000);
    const since = new Date(Date.now() - thresholdMs);

    const [admins, employees, customers] = await Promise.all([
      prisma.admin.findMany({ select: { id: true, fullName: true, lastSeenAt: true } }),
      prisma.employee.findMany({ select: { id: true, fullName: true, lastSeenAt: true } }),
      prisma.customer.findMany({ select: { id: true, title: true, contactFullName: true, lastSeenAt: true } }),
    ]);

    const mapOnline = (arr, nameKey) =>
      arr.map(u => ({
        id: u.id,
        name: u[nameKey],
        lastSeenAt: u.lastSeenAt,
        isOnline: !!(u.lastSeenAt && u.lastSeenAt >= since),
      }));

    return res.json({
      thresholdMs,
      since: since.toISOString(),
      admins: mapOnline(admins, "fullName"),
      employees: mapOnline(employees, "fullName"),
      customers: mapOnline(customers, "title"), // Müşteri için ekran adı title
    });
  } catch (err) {
    console.error("GET /online/summary error:", err);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

export default router;
