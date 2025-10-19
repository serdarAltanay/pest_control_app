// routes/stores.js
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { auth, roleCheck } from "../middleware/auth.js";

const router = Router();
const prisma = new PrismaClient();


const norm = (s) => (typeof s === "string" ? s.trim() : s);
const asEnum = (val, allowed, fallback) =>
  allowed.includes(String(val)) ? String(val) : fallback;
const basicCheck = (body) => {
  if (!norm(body.name)) return "Mağaza adı zorunludur.";
  if (body.phone) {
    const digits = String(body.phone).replace(/\D/g, "");
    if (digits.length > 0 && digits.length < 10) return "Telefon hatalı görünüyor.";
  }
  if (body.code && String(body.code).length > 12) return "Kod en fazla 12 karakter olmalı.";
  return null;
};

router.get("/search", auth, roleCheck(["admin", "employee"]), async (req, res) => {
  try {
    const q = (req.query.q || "").toString().trim();

    if (!q) {
      const latest = await prisma.store.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, name: true, code: true, city: true, phone: true, manager: true, isActive: true },
      });
      return res.json(latest);
    }

    const list = await prisma.store.findMany({
      where: {
        OR: [
          { name: { contains: q } },  // ← mode: "insensitive" KALDIRILDI
          { code: { contains: q } },  // ← mode: "insensitive" KALDIRILDI
        ],
      },
      orderBy: { name: "asc" },
      take: 30,
       select: { id: true, name: true, code: true, city: true, phone: true, manager: true, isActive: true },
    });

    res.json(list);
  } catch (e) {
    console.error("GET /stores/search", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

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
router.post("/", auth, roleCheck(["admin","employee"]), async (req,res)=>{
  try {
    const {
      customerId, name, code, city, address, phone, manager,
      isActive,
      pestType, placeType, areaM2,
      latitude, longitude
    } = req.body;

    const data = {
      customerId: Number(customerId),
      name: String(name),
      code: code ?? null,
      city: city ?? null,
      address: address ?? null,
      phone: phone ?? null,
      manager: manager ?? null,
      isActive: isActive !== undefined ? !!isActive : true,
      pestType: asEnum(pestType, ["KEMIRGEN","HACCADI","UCAN","BELIRTILMEDI"], "BELIRTILMEDI"),
      placeType: asEnum(placeType, ["OFIS","DEPO","MAGAZA","FABRIKA","BELIRTILMEDI"], "BELIRTILMEDI"),
      areaM2: areaM2 != null ? Number(areaM2) : null,
      latitude: latitude != null ? Number(latitude) : null,
      longitude: longitude != null ? Number(longitude) : null,
    };

    const created = await prisma.store.create({ data });
    res.json(created);
  } catch (e) {
    console.error("POST /stores", e);
    res.status(500).json({message:"Sunucu hatası"});
  }
});

// CREATE  POST /api/stores
router.post("/", auth, roleCheck(["admin","employee"]), async (req,res)=>{
  try {
    const {
      customerId, name, code, city, address, phone, manager,
      isActive,
      pestType, placeType, areaM2,
      latitude, longitude
    } = req.body;

    const data = {
      customerId: Number(customerId),
      name: String(name),
      code: code ?? null,
      city: city ?? null,
      address: address ?? null,
      phone: phone ?? null,
      manager: manager ?? null,
      isActive: isActive !== undefined ? !!isActive : true,
      pestType: asEnum(pestType, ["KEMIRGEN","HACCADI","UCAN","BELIRTILMEDI"], "BELIRTILMEDI"),
      placeType: asEnum(placeType, ["OFIS","DEPO","MAGAZA","FABRIKA","BELIRTILMEDI"], "BELIRTILMEDI"),
      areaM2: areaM2 != null ? Number(areaM2) : null,
      latitude: latitude != null ? Number(latitude) : null,
      longitude: longitude != null ? Number(longitude) : null,
    };

    const created = await prisma.store.create({ data });
    res.json(created);
  } catch (e) {
    console.error("POST /stores", e);
    res.status(500).json({message:"Sunucu hatası"});
  }
});

// UPDATE  PUT /api/stores/:storeId
router.put("/:storeId", auth, roleCheck(["admin","employee"]), async (req,res)=>{
  try {
    const id = Number(req.params.storeId);
    const body = req.body;

    const data = {};
    if ("name" in body) data.name = String(body.name);
    if ("code" in body) data.code = body.code ?? null;
    if ("city" in body) data.city = body.city ?? null;
    if ("address" in body) data.address = body.address ?? null;
    if ("phone" in body) data.phone = body.phone ?? null;
    if ("manager" in body) data.manager = body.manager ?? null;
    if ("isActive" in body) data.isActive = !!body.isActive;
    if ("pestType" in body)
      data.pestType = asEnum(body.pestType, ["KEMIRGEN","HACCADI","UCAN","BELIRTILMEDI"], "BELIRTILMEDI");
    if ("placeType" in body)
      data.placeType = asEnum(body.placeType, ["OFIS","DEPO","MAGAZA","FABRIKA","BELIRTILMEDI"], "BELIRTILMEDI");
    if ("areaM2" in body) data.areaM2 = body.areaM2 != null ? Number(body.areaM2) : null;
    if ("latitude" in body) data.latitude = body.latitude != null ? Number(body.latitude) : null;
    if ("longitude" in body) data.longitude = body.longitude != null ? Number(body.longitude) : null;

    const updated = await prisma.store.update({ where: { id }, data });
    res.json(updated);
  } catch (e) {
    console.error("PUT /stores/:id", e);
    res.status(500).json({message:"Sunucu hatası"});
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
