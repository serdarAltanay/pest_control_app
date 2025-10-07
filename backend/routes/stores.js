// routes/stores.js
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { auth, roleCheck } from "../middleware/auth.js";

const router = Router();
const prisma = new PrismaClient();


const norm = (s) => (typeof s === "string" ? s.trim() : s);

const basicCheck = (body) => {
  if (!norm(body.name)) return "Mağaza adı zorunludur.";
  if (body.phone) {
    const digits = String(body.phone).replace(/\D/g, "");
    if (digits.length > 0 && digits.length < 10) return "Telefon hatalı görünüyor.";
  }
  if (body.code && String(body.code).length > 12) return "Kod en fazla 12 karakter olmalı.";
  return null;
};

/** Müşteriye göre mağazalar */
router.get("/customer/:customerId", auth, roleCheck(["admin", "employee"]), async (req, res) => {
  try {
    const customerId = Number(req.params.customerId);
    if (!customerId) return res.status(400).json({ message: "Geçersiz müşteri" });

    const list = await prisma.store.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, code: true, city: true, address: true,
        phone: true, manager: true, isActive: true, latitude: true, longitude: true,
        customerId: true,
      },
    });
    res.json(list);
  } catch (e) {
    console.error("GET /stores/customer/:customerId", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/** Tek mağaza */
router.get("/:id", auth, roleCheck(["admin", "employee"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Geçersiz id" });

    const store = await prisma.store.findUnique({
      where: { id },
      select: {
        id: true, customerId: true, name: true, code: true, city: true,
        address: true, phone: true, manager: true, isActive: true,
        latitude: true, longitude: true,
      },
    });
    if (!store) return res.status(404).json({ message: "Mağaza bulunamadı" });
    res.json(store);
  } catch (e) {
    console.error("GET /stores/:id", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/** Ekle */
router.post("/", auth, roleCheck(["admin"]), async (req, res) => {
  const msg = basicCheck(req.body);
  if (msg) return res.status(400).json({ message: msg });
  try {
    const {
      customerId, name, code, city, address, phone, manager,
      isActive, latitude, longitude
    } = req.body;

    if (!customerId || !name?.trim()) {
      return res.status(400).json({ message: "Müşteri ve mağaza adı zorunludur." });
    }

    const created = await prisma.store.create({
      data: {
        customerId: Number(customerId),
        name: String(name),
        code: code || null,
        city: city || null,
        address: address || null,
        phone: phone || null,
        manager: manager || null,
        isActive: !!isActive,
        latitude: latitude == null ? null : Number(latitude),
        longitude: longitude == null ? null : Number(longitude),
      },
    });

    res.json({ message: "Mağaza eklendi", store: created });
  } catch (e) {
    console.error("POST /stores", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/** Güncelle */
router.put("/:id", auth, roleCheck(["admin"]), async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!id) return res.status(400).json({ message: "Geçersiz id" });
    const msg = basicCheck(req.body);
    if (msg) return res.status(400).json({ message: msg });

    const {
      name, code, city, address, phone, manager,
      isActive, latitude, longitude
    } = req.body;

    const updated = await prisma.store.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code: code || null }),
        ...(city !== undefined && { city: city || null }),
        ...(address !== undefined && { address: address || null }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(manager !== undefined && { manager: manager || null }),
        ...(isActive !== undefined && { isActive: !!isActive }),
        ...(latitude !== undefined && {
          latitude: latitude == null ? null : Number(latitude),
        }),
        ...(longitude !== undefined && {
          longitude: longitude == null ? null : Number(longitude),
        }),
      },
    });

    res.json({ message: "Mağaza güncellendi", store: updated });
  } catch (e) {
    if (e.code === "P2025") return res.status(404).json({ message: "Mağaza bulunamadı" });
    console.error("PUT /stores/:id", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/** Sil */
router.delete("/:id", auth, roleCheck(["admin"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Geçersiz id" });
    await prisma.store.delete({ where: { id } });
    res.json({ message: "Mağaza silindi" });
  } catch (e) {
    if (e.code === "P2025") return res.status(404).json({ message: "Mağaza bulunamadı" });
    console.error("DELETE /stores/:id", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

export default router;
