import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { auth, roleCheck } from "../middleware/auth.js";

const router = Router();
const prisma = new PrismaClient();

/** Liste (sadece admin görsün) */
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
        profileImage: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        lastSeenAt: true, // <<< ÖNEMLİ
        adminId: true,
      },
    });
    res.json(employees);
  } catch (e) {
    console.error("GET /employees", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/** Tekil detay */
router.get("/:id", auth, roleCheck(["admin"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Geçersiz id" });

    const emp = await prisma.employee.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        email: true,
        jobTitle: true,
        gsm: true,
        profileImage: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        lastSeenAt: true, // <<< ÖNEMLİ
        adminId: true,
      },
    });
    if (!emp) return res.status(404).json({ message: "Kayıt bulunamadı" });
    res.json(emp);
  } catch (e) {
    console.error("GET /employees/:id", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/** Oluştur */
router.post("/create", auth, roleCheck(["admin"]), async (req, res) => {
  try {
    const { fullName, jobTitle, gsm, email, password, adminId } = req.body || {};
    if (!fullName || !jobTitle || !gsm || !email || !password) {
      return res.status(400).json({ message: "Zorunlu alanlar eksik." });
    }
    const exists = await prisma.employee.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ message: "E-posta kullanımda." });

    const hashed = await bcrypt.hash(String(password), 10);
    const created = await prisma.employee.create({
      data: {
        fullName,
        jobTitle,
        gsm,
        email,
        password: hashed,
        adminId: adminId ? Number(adminId) : null,
      },
      select: { id: true },
    });
    res.json({ ok: true, id: created.id });
  } catch (e) {
    console.error("POST /employees/create", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/** Güncelle */
router.put("/:id", auth, roleCheck(["admin"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Geçersiz id" });

    const { fullName, jobTitle, gsm, email, password, adminId } = req.body || {};
    const data = {};
    if (fullName !== undefined) data.fullName = String(fullName);
    if (jobTitle !== undefined) data.jobTitle = String(jobTitle);
    if (gsm !== undefined) data.gsm = String(gsm);
    if (email !== undefined) data.email = String(email);
    if (typeof adminId !== "undefined") data.adminId = adminId ? Number(adminId) : null;
    if (password) data.password = await bcrypt.hash(String(password), 10);

    const updated = await prisma.employee.update({
      where: { id },
      data,
      select: {
        id: true,
        updatedAt: true,
        lastSeenAt: true, // <<< ÖNEMLİ
      },
    });
    res.json({ ok: true, employee: updated });
  } catch (e) {
    if (e.code === "P2025")
      return res.status(404).json({ message: "Kayıt bulunamadı" });
    console.error("PUT /employees/:id", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/** Sil */
router.delete("/:id", auth, roleCheck(["admin"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Geçersiz id" });
    await prisma.employee.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === "P2025")
      return res.status(404).json({ message: "Kayıt bulunamadı" });
    console.error("DELETE /employees/:id", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

export default router;
