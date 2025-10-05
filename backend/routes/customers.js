import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { auth, roleCheck } from "../middleware/auth.js";

const router = Router();
const prisma = new PrismaClient();

/** Liste (admin + employee) */
router.get("/", auth, roleCheck(["admin", "employee"]), async (req, res) => {
  try {
    const where = req.user.role === "employee" ? { employeeId: req.user.id } : {};
    const customers = await prisma.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, code: true, title: true, city: true, email: true, visitPeriod: true,
        contactFullName: true, phone: true, gsm: true, address: true,
        lastLoginAt: true, lastSeenAt: true, updatedAt: true, createdAt: true,
        employee: { select: { id: true, fullName: true } },
      },
    });
    res.json(customers);
  } catch (err) {
    console.error("GET /customers error:", err);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/** Detay (admin + employee kendi kaydı) */
router.get("/:id", auth, roleCheck(["admin", "employee"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Geçersiz id" });

    const where = req.user.role === "employee" ? { id, employeeId: req.user.id } : { id };
    const c = await prisma.customer.findFirst({
      where,
      select: {
        id: true, code: true, title: true, accountingTitle: true, email: true,
        contactFullName: true, phone: true, gsm: true, address: true, city: true,
        pestType: true, areaM2: true, placeType: true, showBalance: true, visitPeriod: true,
        lastLoginAt: true, lastSeenAt: true, createdAt: true, updatedAt: true,
        employee: { select: { id: true, fullName: true, email: true } },
      },
    });

    if (!c) return res.status(404).json({ message: "Müşteri bulunamadı" });
    res.json(c);
  } catch (err) {
    console.error("GET /customers/:id error:", err);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/** Ekle (admin) */
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
        code, title,
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
        pestType: pestType || "BELIRTILMEDI",
        areaM2: areaM2 ? parseFloat(areaM2) : null,
        placeType: placeType || "BELIRTILMEDI",
        showBalance: !!showBalance,
        visitPeriod: visitPeriod || "BELIRTILMEDI",
        employeeId: employeeId || null,
      },
    });

    res.json({ message: "Müşteri eklendi", customer: c });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/** Güncelle (admin) */
router.put("/:id", auth, roleCheck(["admin"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Geçersiz id" });

    const {
      code, title, accountingTitle, email, password,
      contactFullName, phone, gsm, taxOffice, taxNumber,
      address, city, pestType, areaM2, placeType,
      showBalance, visitPeriod, employeeId,
    } = req.body;

    // code uniq
    if (code) {
      const other = await prisma.customer.findUnique({ where: { code } });
      if (other && other.id !== id) {
        return res.status(409).json({ message: "Bu müşteri kodu kullanımda." });
      }
    }

    const data = {};
    if (code !== undefined) data.code = code;
    if (title !== undefined) data.title = title;
    if (accountingTitle !== undefined) data.accountingTitle = accountingTitle || null;
    if (email !== undefined) data.email = email || null;
    if (password) data.password = await bcrypt.hash(password, 10);
    if (contactFullName !== undefined) data.contactFullName = contactFullName || null;
    if (phone !== undefined) data.phone = phone || null;
    if (gsm !== undefined) data.gsm = gsm || null;
    if (taxOffice !== undefined) data.taxOffice = taxOffice || null;
    if (taxNumber !== undefined) data.taxNumber = taxNumber || null;
    if (address !== undefined) data.address = address || null;
    if (city !== undefined) data.city = city || null;
    if (pestType !== undefined) data.pestType = pestType || "BELIRTILMEDI";
    if (areaM2 !== undefined) data.areaM2 = areaM2 ? parseFloat(areaM2) : null;
    if (placeType !== undefined) data.placeType = placeType || "BELIRTILMEDI";
    if (showBalance !== undefined) data.showBalance = !!showBalance;
    if (visitPeriod !== undefined) data.visitPeriod = visitPeriod || "BELIRTILMEDI";
    if (employeeId !== undefined) data.employeeId = employeeId || null;

    const updated = await prisma.customer.update({ where: { id }, data });
    res.json({ message: "Müşteri güncellendi", customer: updated });
  } catch (e) {
    if (e.code === "P2025") return res.status(404).json({ message: "Müşteri bulunamadı" });
    console.error("PUT /customers/:id error:", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/** Sil (admin) – profil resmi silme upload modülünüzde ele alınıyor */
router.delete("/:id", auth, roleCheck(["admin"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Geçersiz id" });
    await prisma.customer.delete({ where: { id } });
    res.json({ message: "Müşteri silindi" });
  } catch (e) {
    if (e.code === "P2025") return res.status(404).json({ message: "Müşteri bulunamadı" });
    console.error("DELETE /customers/:id error:", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

export default router;
