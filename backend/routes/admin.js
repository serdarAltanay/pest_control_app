import express from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { auth, roleCheck } from "../middleware/auth.js";

const router = express.Router();
const prisma = new PrismaClient();

/** Liste (table) */
router.get("/", auth, roleCheck(["admin"]), async (_req, res) => {
  try {
    const admins = await prisma.admin.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fullName: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        lastSeenAt: true,
      },
    });
    res.json(admins);
  } catch (err) {
    console.error("GET /admin error:", err);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/** Sadece dropdown için kısa liste */
router.get("/admins", auth, roleCheck(["admin"]), async (_req, res) => {
  try {
    const list = await prisma.admin.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fullName: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        lastSeenAt: true,
      },
    });
    res.json(list);
  } catch (e) {
    console.error("GET /admins error:", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/** Ekle */
router.post("/create", auth, roleCheck(["admin"]), async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "Ad Soyad, email ve parola zorunludur." });
    }
    const exists = await prisma.admin.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ message: "Bu email zaten kayıtlı." });

    const hashed = await bcrypt.hash(String(password), 10);
    const admin = await prisma.admin.create({
      data: { fullName, email, password: hashed },
    });
    res.json({ message: "Yönetici eklendi", admin });
  } catch (e) {
    console.error("POST /create error:", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/** Güncelle */
router.put("/:id", auth, roleCheck(["admin"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Geçersiz id" });

    const { fullName, email, password } = req.body;

    // Email benzersizlik
    if (email) {
      const other = await prisma.admin.findUnique({ where: { email } });
      if (other && other.id !== id) {
        return res.status(409).json({ message: "Bu e-posta başka bir kullanıcıya ait." });
      }
    }

    const data = { };
    if (fullName !== undefined) data.fullName = fullName;
    if (email !== undefined) data.email = email;
    if (password) data.password = await bcrypt.hash(String(password), 10);

    const updated = await prisma.admin.update({ where: { id }, data });
    res.json({ message: "Yönetici güncellendi", admin: updated });
  } catch (e) {
    if (e.code === "P2025") return res.status(404).json({ message: "Kayıt bulunamadı" });
    console.error("PUT /:id error:", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

router.get("/:id", auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Geçersiz id" });
    }

    const admin = await prisma.admin.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        email: true,
        profileImage: true,   // << avatar yolu
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        lastSeenAt: true,
        lastProfileAt: true,
      },
    });

    if (!admin) return res.status(404).json({ error: "Kayıt bulunamadı" });
    res.json(admin);
  } catch (e) {
    console.error("GET /admin/:id error:", e);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

/** Sil (profil resmi varsa upload modülünde zaten kaldırıyoruz) */
router.delete("/:id", auth, roleCheck(["admin"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Geçersiz id" });
    await prisma.admin.delete({ where: { id } });
    res.json({ message: "Yönetici silindi" });
  } catch (e) {
    if (e.code === "P2025") return res.status(404).json({ message: "Yönetici bulunamadı" });
    console.error("DELETE /:id error:", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

export default router;
