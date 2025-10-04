import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { auth, roleCheck } from "../middleware/auth.js";

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/employees
 * - Sadece admin
 */
router.get("/", auth, roleCheck(["admin"]), async (_req, res) => {
  try {
    const employees = await prisma.employee.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fullName: true,
        email: true,
        jobTitle: true,
        gsm: true,
        adminId: true,
        createdAt: true,
      },
    });
    res.json(employees);
  } catch (err) {
    console.error("GET /employees error:", err);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

// --- PERSONEL EKLE ---
router.post("/create", auth, roleCheck(["admin"]), async (req, res) => {
  try {
    const { fullName, jobTitle, gsm, email, password, adminId } = req.body;

    // ZORUNLU ALANLAR
    if (!fullName || !jobTitle || !gsm || !email || !password) {
      return res.status(400).json({
        message: "Ad Soyad, Görev, GSM, E-posta ve Parola zorunludur.",
      });
    }

    const emailNorm = String(email).trim().toLowerCase();
    const hashed = await bcrypt.hash(String(password), 10);

    const emp = await prisma.employee.create({
      data: {
        fullName,
        jobTitle,
        gsm,
        email: emailNorm,
        password: hashed,
        adminId: adminId || null,
      },
    });

    res.json({ message: "Personel eklendi", employee: emp });
  } catch (e) {
    if (e.code === "P2002") {
      return res.status(409).json({ message: "Bu e-posta zaten kayıtlı." });
    }
    console.error("POST /employees/create error:", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

export default router;
