import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { auth, roleCheck } from "../middleware/auth.js";

const router = Router();
const prisma = new PrismaClient();

/** Liste */
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
        updatedAt: true,
        lastLoginAt: true,
        lastSeenAt: true,
      },
    });
    res.json(employees);
  } catch (err) {
    console.error("GET /employees error:", err);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/** Ekle */
router.post("/create", auth, roleCheck(["admin"]), async (req, res) => {
  try {
    const { fullName, jobTitle, gsm, email, password, adminId } = req.body;
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

/** Güncelle */
router.put("/:id", auth, roleCheck(["admin"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Geçersiz id" });

    const { fullName, jobTitle, gsm, email, password, adminId } = req.body;

    // email uniq
    if (email) {
      const emailNorm = String(email).trim().toLowerCase();
      const other = await prisma.employee.findUnique({ where: { email: emailNorm } });
      if (other && other.id !== id) {
        return res.status(409).json({ message: "Bu e-posta başka bir kullanıcıya ait." });
      }
    }

    const data = {};
    if (fullName !== undefined) data.fullName = fullName;
    if (jobTitle !== undefined) data.jobTitle = jobTitle;
    if (gsm !== undefined) data.gsm = gsm;
    if (email !== undefined) data.email = String(email).trim().toLowerCase();
    if (adminId !== undefined) data.adminId = adminId || null;
    if (password) data.password = await bcrypt.hash(String(password), 10);

    const updated = await prisma.employee.update({ where: { id }, data });
    res.json({ message: "Personel güncellendi", employee: updated });
  } catch (e) {
    if (e.code === "P2025") return res.status(404).json({ message: "Kayıt bulunamadı" });
    console.error("PUT /employees/:id error:", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/** Sil */
router.delete("/:id", auth, roleCheck(["admin"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Geçersiz id" });
    await prisma.employee.delete({ where: { id } });
    res.json({ message: "Personel silindi" });
  } catch (e) {
    if (e.code === "P2025") return res.status(404).json({ message: "Personel bulunamadı" });
    console.error("DELETE /employees/:id error:", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

export default router;
