// routes/stores.js
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { auth, roleCheck } from "../middleware/auth.js";

const prisma = new PrismaClient();
const router = Router();

/** Müşteriye göre liste */
router.get("/customer/:customerId", auth, roleCheck(["admin", "employee"]), async (req, res) => {
  try {
    const customerId = Number(req.params.customerId);
    if (!customerId) return res.status(400).json({ message: "Geçersiz customerId" });

    const stores = await prisma.store.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, code: true, city: true, address: true,
        phone: true, manager: true, isActive: true, latitude: true, longitude: true,
        createdAt: true, updatedAt: true,
      },
    });
    res.json(stores);
  } catch (e) {
    console.error("GET /stores/customer/:customerId error:", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/** Tek mağaza (edit sayfası) */
router.get("/:id", auth, roleCheck(["admin", "employee"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Geçersiz id" });
    const store = await prisma.store.findUnique({
      where: { id },
      include: { customer: { select: { id: true, title: true, city: true, address: true } } },
    });
    if (!store) return res.status(404).json({ message: "Mağaza bulunamadı" });
    res.json(store);
  } catch (e) {
    console.error("GET /stores/:id error:", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/** Ekle */
router.post("/", auth, roleCheck(["admin", "employee"]), async (req, res) => {
  try {
    const { customerId, name, code, city, address, phone, manager, isActive, latitude, longitude } = req.body;
    if (!customerId || !name) {
      return res.status(400).json({ message: "customerId ve name zorunludur." });
    }
    // sayılar
    const lat = latitude === undefined || latitude === null || latitude === "" ? null : Number(latitude);
    const lng = longitude === undefined || longitude === null || longitude === "" ? null : Number(longitude);

    const store = await prisma.store.create({
      data: {
        customerId: Number(customerId),
        name: String(name),
        code: code ? String(code) : null,
        city: city || null,
        address: address || null,
        phone: phone || null,
        manager: manager || null,
        isActive: !!(isActive ?? true),
        latitude: lat,
        longitude: lng,
      },
    });
    res.json({ message: "Mağaza eklendi", store });
  } catch (e) {
    // unique ihlali (aynı müşteri + code)
    if (e.code === "P2002") {
      return res.status(409).json({ message: "Bu Müşteri için bu Kod zaten kullanımda." });
    }
    console.error("POST /stores error:", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/** Güncelle */
router.put("/:id", auth, roleCheck(["admin", "employee"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Geçersiz id" });

    const { name, code, city, address, phone, manager, isActive, latitude, longitude } = req.body;
    const data = {};
    if (name !== undefined) data.name = String(name);
    if (code !== undefined) data.code = code || null;
    if (city !== undefined) data.city = city || null;
    if (address !== undefined) data.address = address || null;
    if (phone !== undefined) data.phone = phone || null;
    if (manager !== undefined) data.manager = manager || null;
    if (isActive !== undefined) data.isActive = !!isActive;

    if (latitude !== undefined) {
      data.latitude = latitude === null || latitude === "" ? null : Number(latitude);
    }
    if (longitude !== undefined) {
      data.longitude = longitude === null || longitude === "" ? null : Number(longitude);
    }

    const store = await prisma.store.update({ where: { id }, data });
    res.json({ message: "Mağaza güncellendi", store });
  } catch (e) {
    if (e.code === "P2025") return res.status(404).json({ message: "Mağaza bulunamadı" });
    if (e.code === "P2002") return res.status(409).json({ message: "Bu Müşteri için bu Kod kullanımda." });
    console.error("PUT /stores/:id error:", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/** Sil */
router.delete("/:id", auth, roleCheck(["admin", "employee"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Geçersiz id" });
    await prisma.store.delete({ where: { id } });
    res.json({ message: "Mağaza silindi" });
  } catch (e) {
    if (e.code === "P2025") return res.status(404).json({ message: "Mağaza bulunamadı" });
    console.error("DELETE /stores/:id error:", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

export default router;
