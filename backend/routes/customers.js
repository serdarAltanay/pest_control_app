// routes/customers.js
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { auth, roleCheck } from "../middleware/auth.js";

const router = Router();
const prisma = new PrismaClient();

// Müşterileri listele (admin ve employee)
router.get("/", auth, async (req, res) => {
  try {
    const role = req.user?.role;
    if (role !== "admin" && role !== "employee") {
      return res.status(403).json({ message: "Yetkisiz erişim" });
    }

    const where = role === "employee" ? { employeeId: req.user.id } : {};

    const customers = await prisma.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        code: true,
        title: true,
        city: true,              // <-- EKLENDİ
        email: true,
        visitPeriod: true,       // <-- EKLENDİ
        contactFullName: true,
        phone: true,
        gsm: true,
        address: true,
        lastLoginAt: true,
        lastSeenAt: true,        // presence kullanıyorsan
        updatedAt: true,
        createdAt: true,
        employee: {              // “Sorumlu” için
          select: { id: true, fullName: true },
        },
      },
    });

    res.json(customers);
  } catch (err) {
    console.error("GET /customers error:", err);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

// --- MÜŞTERİ EKLE ---
router.post("/create", auth, roleCheck(["admin"]), async (req, res) => {
  try {
    const {
      code, title, accountingTitle, email, password,
      contactFullName, phone, gsm, taxOffice, taxNumber,
      address, city, pestType, areaM2, placeType,
      showBalance, visitPeriod, employeeId,
    } = req.body;

    if (!code || !title)
      return res.status(400).json({ message: "Müşteri Kodu ve Ünvan zorunludur." });

    const exists = await prisma.customer.findUnique({ where: { code } });
    if (exists) return res.status(409).json({ message: "Bu müşteri kodu zaten kayıtlı." });

    const hashed = password ? await bcrypt.hash(password, 10) : null;

    const c = await prisma.customer.create({
      data: {
        code,
        title,
        accountingTitle: accountingTitle || null,
        email: email || null,
        password: hashed,
        contactFullName: contactFullName || null,
        phone: phone || null,
        gsm: gsm || null,
        taxOffice: taxOffice || null,
        taxNumber: taxNumber || null,
        address: address || null,
        city: city || null,
        pestType: (pestType || "BELIRTILMEDI"),
        areaM2: areaM2 ? parseFloat(areaM2) : null,
        placeType: (placeType || "BELIRTILMEDI"),
        showBalance: !!showBalance,
        visitPeriod: (visitPeriod || "BELIRTILMEDI"),
        employeeId: employeeId || null,
      },
    });

    res.json({ message: "Müşteri eklendi", customer: c });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

router.delete("/:id", auth, roleCheck(["admin"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Geçersiz id" });

    await prisma.customer.delete({ where: { id } });
    return res.json({ message: "Müşteri silindi" });
  } catch (e) {
    if (e.code === "P2025") {
      return res.status(404).json({ message: "Müşteri bulunamadı" });
    }
    console.error("DELETE /customers/:id error:", e);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

export default router;
