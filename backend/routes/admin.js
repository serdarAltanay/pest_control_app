// routes/admin.js
import express from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { auth, roleCheck } from "../middleware/auth.js";

const router = express.Router();
const prisma = new PrismaClient();

router.get("/", auth, roleCheck(["admin"]), async (_req, res) => {
  try {
    const admins = await prisma.admin.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fullName: true,
        email: true,
        createdAt: true,
        lastSeenAt: true,  // <-- EKLENDİ
      },
    });
    res.json(admins);
  } catch (err) {
    console.error("GET / (admins) error:", err);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});


// --- ADMIN EKLE ---
router.post("/create", auth, roleCheck(["admin"]), async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "Ad Soyad, email ve parola zorunludur." });
    }

    const exists = await prisma.admin.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ message: "Bu email zaten kayıtlı." });

    const hashed = await bcrypt.hash(password, 10);
    const admin = await prisma.admin.create({
      data: { fullName, email, password: hashed },
    });

    res.json({ message: "Yönetici eklendi", admin });
  } catch (e) {
    console.error("POST /create error:", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

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
        lastSeenAt: true,   // <-- EKLENDİ
      },
    });
    res.json(list);
  } catch (e) {
    console.error("GET /admins error:", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});


export default router;
