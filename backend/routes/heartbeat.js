// routes/heartbeat.js
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { auth } from "../middleware/auth.js";

const router = Router();
const prisma = new PrismaClient();

/**
 * POST /api/heartbeat/pulse
 * - Access token ile korunur
 * - Kullanıcının lastSeenAt alanını now() yapar
 */
router.post("/pulse", auth, async (req, res) => {
  try {
    const { id, role } = req.user;
    const now = new Date();

    if (role === "admin") {
      await prisma.admin.update({ where: { id }, data: { lastSeenAt: now } });
    } else if (role === "employee") {
      await prisma.employee.update({ where: { id }, data: { lastSeenAt: now } });
    } else if (role === "customer") {
      await prisma.customer.update({ where: { id }, data: { lastSeenAt: now } });
    } else {
      return res.status(400).json({ ok: false, message: "Bilinmeyen rol" });
    }

    return res.json({ ok: true, at: now.toISOString() });
  } catch (err) {
    console.error("POST /heartbeat/pulse error:", err);
    return res.status(500).json({ ok: false, message: "Sunucu hatası" });
  }
});

export default router;
