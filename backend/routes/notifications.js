// routes/notifications.js
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { auth } from "../middleware/auth.js";

const prisma = new PrismaClient();
const router = Router();

// Employee'ın GÖREMEYECEĞİ bildirim tipleri
const EMPLOYEE_BLOCKED_TYPES = ["COMPLAINT_NEW", "COMPLAINT_SEEN", "SUGGESTION_NEW"];

/** Ortak where yardımcısı */
function baseWhereForRole(role, userId, extra = {}) {
  if (role === "admin") {
    return { recipientRole: "ADMIN", ...extra };
  }
  if (role === "employee") {
    // Admin havuzunu görür ama şikayet/öneri bildirimleri hariç
    return {
      recipientRole: "ADMIN",
      NOT: { type: { in: EMPLOYEE_BLOCKED_TYPES } },
      ...extra,
    };
  }
  if (role === "customer") {
    return { recipientRole: "CUSTOMER", recipientId: userId, ...extra };
  }
  // Diğer rollere kapalı
  return { id: -1 };
}

/* Liste: role'e göre */
router.get("/", auth, async (req, res) => {
  try {
    const where = baseWhereForRole(req.user.role, req.user.id);
    const rows = await prisma.notification.findMany({
      where,
      orderBy: [{ isRead: "asc" }, { createdAt: "desc" }],
      take: 200,
    });
    res.json(rows);
  } catch (e) {
    console.error("GET /notifications", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/* Okunmamış sayısı */
router.get("/unread-count", auth, async (req, res) => {
  try {
    const where = baseWhereForRole(req.user.role, req.user.id, { isRead: false });
    const count = await prisma.notification.count({ where });
    res.json({ count });
  } catch (e) {
    console.error("GET /notifications/unread-count", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/* Tek tek okundu işaretleme */
router.patch("/:id/read", auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Geçersiz id" });

    const n = await prisma.notification.findUnique({ where: { id } });
    if (!n) return res.status(404).json({ message: "Kayıt bulunamadı" });

    // Yetki kontrolü
    if (req.user.role === "customer") {
      if (!(n.recipientRole === "CUSTOMER" && n.recipientId === req.user.id)) {
        return res.status(403).json({ message: "Yetkisiz işlem" });
      }
    } else if (req.user.role === "admin") {
      if (n.recipientRole !== "ADMIN") {
        return res.status(403).json({ message: "Yetkisiz işlem" });
      }
    } else if (req.user.role === "employee") {
      // Admin havuzu ama şikayet/öneri yok
      if (n.recipientRole !== "ADMIN") {
        return res.status(403).json({ message: "Yetkisiz işlem" });
      }
      if (EMPLOYEE_BLOCKED_TYPES.includes(n.type)) {
        return res.status(403).json({ message: "Yetkisiz işlem" });
      }
    } else {
      return res.status(403).json({ message: "Yetkisiz işlem" });
    }

    await prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
    res.json({ ok: true });
  } catch (e) {
    console.error("PATCH /notifications/:id/read", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/* Tümünü okundu işaretle */
router.post("/mark-all-read", auth, async (req, res) => {
  try {
    const where = baseWhereForRole(req.user.role, req.user.id, { isRead: false });
    await prisma.notification.updateMany({
      where,
      data: { isRead: true, readAt: new Date() },
    });
    res.json({ ok: true });
  } catch (e) {
    console.error("POST /notifications/mark-all-read", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

export default router;
