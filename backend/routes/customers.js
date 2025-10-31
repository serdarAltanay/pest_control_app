// src/routes/customers.js
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { auth, roleCheck } from "../middleware/auth.js";

const router = Router();
const prisma = new PrismaClient();

/**
 * LIST (admin + employee)
 * - Her iki rol de TÜM müşterileri görür.
 */
router.get("/", auth, roleCheck(["admin", "employee"]), async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        code: true,
        title: true,
        city: true,
        email: true,           // sadece iletişim
        visitPeriod: true,
        contactFullName: true,
        phone: true,
        gsm: true,
        address: true,
        updatedAt: true,
        createdAt: true,
        employee: { select: { id: true, fullName: true } },
      },
    });

    res.json(customers);
  } catch (err) {
    console.error("GET /customers error:", err);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/**
 * DETAIL (admin + employee)
 * - Her iki rol de herhangi bir müşterinin detayını görebilir.
 * - Presence alanları YOK
 * - Store’lar placeType/areaM2 artık Store’da
 */
router.get("/:id", auth, roleCheck(["admin", "employee"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Geçersiz id" });

    const c = await prisma.customer.findFirst({
      where: { id },
      select: {
        id: true,
        code: true,
        title: true,
        accountingTitle: true,
        email: true, // iletişim
        contactFullName: true,
        phone: true,
        gsm: true,
        address: true,
        city: true,
        showBalance: true,
        visitPeriod: true,
        createdAt: true,
        updatedAt: true,
        employee: { select: { id: true, fullName: true, email: true } },
        stores: {
          select: {
            id: true,
            name: true,
            code: true,
            city: true,
            address: true,
            phone: true,
            manager: true,
            isActive: true,
            latitude: true,
            longitude: true,
            placeType: true,
            areaM2: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        _count: { select: { stores: true } },
      },
    });

    if (!c) return res.status(404).json({ message: "Müşteri bulunamadı" });
    res.json(c);
  } catch (err) {
    console.error("GET /customers/:id error:", err);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/**
 * CREATE (admin + employee)
 * - password yok; email sadece iletişim için
 */
router.post("/create", auth, roleCheck(["admin", "employee"]), async (req, res) => {
  try {
    const {
      code,
      title,
      accountingTitle,
      email,
      contactFullName,
      phone,
      gsm,
      taxOffice,
      taxNumber,
      address,
      city,
      showBalance,
      visitPeriod,
      employeeId,
    } = req.body;

    if (!code || !title) {
      return res.status(400).json({ message: "Müşteri Kodu ve Ünvan zorunludur." });
    }

    const exists = await prisma.customer.findUnique({ where: { code } });
    if (exists) {
      return res.status(409).json({ message: "Bu müşteri kodu zaten kayıtlı." });
    }

    const c = await prisma.customer.create({
      data: {
        code: String(code),
        title: String(title),
        accountingTitle: accountingTitle || null,
        email: email || null, // yalnız iletişim
        contactFullName: contactFullName || null,
        phone: phone || null,
        gsm: gsm || null,
        taxOffice: taxOffice || null,
        taxNumber: taxNumber || null,
        address: address || null,
        city: city || null,
        showBalance: !!showBalance,
        visitPeriod: visitPeriod || "BELIRTILMEDI",
        employeeId: employeeId || null,
      },
    });

    res.json({ message: "Müşteri eklendi", customer: c });
  } catch (e) {
    console.error("POST /customers/create error:", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/**
 * UPDATE (admin + employee)
 * - password yok; presence alanı yok
 */
router.put("/:id", auth, roleCheck(["admin", "employee"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Geçersiz id" });

    const {
      code,
      title,
      accountingTitle,
      email,
      contactFullName,
      phone,
      gsm,
      taxOffice,
      taxNumber,
      address,
      city,
      showBalance,
      visitPeriod,
      employeeId,
    } = req.body;

    if (code) {
      const other = await prisma.customer.findUnique({ where: { code } });
      if (other && other.id !== id) {
        return res.status(409).json({ message: "Bu müşteri kodu kullanımda." });
      }
    }

    const data = {};
    if (code !== undefined) data.code = String(code);
    if (title !== undefined) data.title = String(title);
    if (accountingTitle !== undefined) data.accountingTitle = accountingTitle || null;
    if (email !== undefined) data.email = email || null;
    if (contactFullName !== undefined) data.contactFullName = contactFullName || null;
    if (phone !== undefined) data.phone = phone || null;
    if (gsm !== undefined) data.gsm = gsm || null;
    if (taxOffice !== undefined) data.taxOffice = taxOffice || null;
    if (taxNumber !== undefined) data.taxNumber = taxNumber || null;
    if (address !== undefined) data.address = address || null;
    if (city !== undefined) data.city = city || null;
    if (showBalance !== undefined) data.showBalance = !!showBalance;
    if (visitPeriod !== undefined) data.visitPeriod = visitPeriod || "BELIRTILMEDI";
    if (employeeId !== undefined) data.employeeId = employeeId || null;

    const updated = await prisma.customer.update({ where: { id }, data });
    res.json({ message: "Müşteri güncellendi", customer: updated });
  } catch (e) {
    if (e.code === "P2025")
      return res.status(404).json({ message: "Müşteri bulunamadı" });
    console.error("PUT /customers/:id error:", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/**
 * DELETE (admin)
 */
router.delete("/:id", auth, roleCheck(["admin"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Geçersiz id" });

    await prisma.customer.delete({ where: { id } });
    res.json({ message: "Müşteri silindi" });
  } catch (e) {
    if (e.code === "P2025")
      return res.status(404).json({ message: "Müşteri bulunamadı" });
    console.error("DELETE /customers/:id error:", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

export default router;
