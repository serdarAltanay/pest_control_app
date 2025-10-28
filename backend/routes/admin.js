import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { auth, roleCheck } from "../middleware/auth.js";

const router = Router();
const prisma = new PrismaClient();

/** Tüm adminler (liste) */
router.get("/admins", auth, roleCheck(["admin"]), async (_req, res) => {
  try {
    const admins = await prisma.admin.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fullName: true,
        email: true,
        profileImage: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        lastSeenAt: true, // <<< ÖNEMLİ
      },
    });
    res.json(admins);
  } catch (e) {
    console.error("GET /admin/admins", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/** Tek admin detay */
router.get("/:id", auth, roleCheck(["admin"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Geçersiz id" });

    const a = await prisma.admin.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        email: true,
        profileImage: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        lastSeenAt: true, // <<< ÖNEMLİ
      },
    });
    if (!a) return res.status(404).json({ message: "Kayıt bulunamadı" });
    res.json(a);
  } catch (e) {
    console.error("GET /admin/:id", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/** Admin oluştur */
router.post("/create", auth, roleCheck(["admin"]), async (req, res) => {
  try {
    const { fullName, email, password } = req.body || {};
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "Zorunlu alanlar eksik." });
    }
    const exists = await prisma.admin.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ message: "E-posta kullanımda." });

    const hashed = await bcrypt.hash(String(password), 10);
    const created = await prisma.admin.create({
      data: { fullName, email, password: hashed },
      select: { id: true },
    });
    res.json({ ok: true, id: created.id });
  } catch (e) {
    console.error("POST /admin/create", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/** Admin güncelle */
router.put("/:id", auth, roleCheck(["admin"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Geçersiz id" });

    const { fullName, email, password } = req.body || {};
    const data = {};
    if (fullName !== undefined) data.fullName = String(fullName);
    if (email !== undefined) data.email = String(email);
    if (password) data.password = await bcrypt.hash(String(password), 10);

    const updated = await prisma.admin.update({
      where: { id },
      data,
      select: {
        id: true,
        fullName: true,
        email: true,
        updatedAt: true,
        lastSeenAt: true, // <<< ÖNEMLİ
      },
    });
    res.json({ ok: true, admin: updated });
  } catch (e) {
    if (e.code === "P2025")
      return res.status(404).json({ message: "Kayıt bulunamadı" });
    console.error("PUT /admin/:id", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/** Admin sil */
router.delete("/:id", auth, roleCheck(["admin"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Geçersiz id" });
    await prisma.admin.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === "P2025")
      return res.status(404).json({ message: "Kayıt bulunamadı" });
    console.error("DELETE /admin/:id", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

export default router;
