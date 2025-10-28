// src/routes/online.js
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { auth, roleCheck } from "../middleware/auth.js";

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /online/summary?thresholdMs=120000
 * - Sadece admin
 * - lastSeenAt >= now - thresholdMs => online
 * - Kapsam: admins, employees, accessOwners (customer YOK)
 */
router.get("/summary", auth, roleCheck(["admin"]), async (req, res) => {
  try {
    const thresholdMs = Number(req.query.thresholdMs || 120000);
    const since = new Date(Date.now() - thresholdMs);

    const [admins, employees, accessOwners] = await Promise.all([
      prisma.admin.findMany({ select: { id: true, fullName: true, lastSeenAt: true } }),
      prisma.employee.findMany({ select: { id: true, fullName: true, lastSeenAt: true } }),
      prisma.accessOwner.findMany({ select: { id: true, firstName: true, lastName: true, email: true, lastSeenAt: true } }),
    ]);

    const mapOnlineAdmins = admins.map(u => ({
      id: u.id,
      name: u.fullName,
      lastSeenAt: u.lastSeenAt,
      isOnline: !!(u.lastSeenAt && u.lastSeenAt >= since),
    }));

    const mapOnlineEmployees = employees.map(u => ({
      id: u.id,
      name: u.fullName,
      lastSeenAt: u.lastSeenAt,
      isOnline: !!(u.lastSeenAt && u.lastSeenAt >= since),
    }));

    const mapOnlineOwners = accessOwners.map(u => {
      const name = [u.firstName || "", u.lastName || ""].join(" ").trim() || u.email;
      return {
        id: u.id,
        name,
        lastSeenAt: u.lastSeenAt,
        isOnline: !!(u.lastSeenAt && u.lastSeenAt >= since),
      };
    });

    return res.json({
      thresholdMs,
      since: since.toISOString(),
      admins: mapOnlineAdmins,
      employees: mapOnlineEmployees,
      accessOwners: mapOnlineOwners,
    });
  } catch (err) {
    console.error("GET /online/summary error:", err);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

export default router;
