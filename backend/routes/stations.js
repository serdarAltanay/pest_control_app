import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { auth, roleCheck } from "../middleware/auth.js";

const prisma = new PrismaClient();
const router = Router();

// Store'a göre liste
router.get("/store/:storeId", auth, roleCheck(["admin", "employee"]), async (req, res) => {
  try {
    const storeId = Number(req.params.storeId);
    if (!storeId) return res.status(400).json({ message: "Geçersiz storeId" });

    const items = await prisma.station.findMany({
      where: { storeId },
      orderBy: { createdAt: "desc" },
    });
    res.json(items);
  } catch (e) {
    console.error("GET /stations/store/:storeId", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

// Metrikler (grafik için)
router.get("/metrics/store/:storeId", auth, roleCheck(["admin", "employee"]), async (req, res) => {
  try {
    const storeId = Number(req.params.storeId);
    if (!storeId) return res.status(400).json({ message: "Geçersiz storeId" });

    const list = await prisma.station.groupBy({
      by: ["type"],
      where: { storeId, isActive: true },
      _count: { type: true },
    });

    const all = ["FARE_YEMLEME","CANLI_YAKALAMA","ELEKTRIKLI_SINEK_TUTUCU","BOCEK_MONITOR","GUVE_TUZAGI"];
    const data = Object.fromEntries(all.map(t => [t, 0]));
    list.forEach(r => { data[r.type] = r._count.type; });
    res.json(data);
  } catch (e) {
    console.error("GET /stations/metrics/store/:storeId", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

// Detay
router.get("/:id", auth, roleCheck(["admin", "employee"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const item = await prisma.station.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ message: "Bulunamadı" });
    res.json(item);
  } catch (e) {
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

// Ekle
router.post("/", auth, roleCheck(["admin"]), async (req, res) => {
  try {
    const { storeId, type, name, code, isActive = true } = req.body;
    if (!storeId || !type || !name || !code)
      return res.status(400).json({ message: "storeId, type, name, code zorunlu." });

    const store = await prisma.store.findUnique({ where: { id: Number(storeId) } });
    if (!store) return res.status(404).json({ message: "Mağaza bulunamadı" });

    const created = await prisma.station.create({
      data: { storeId: Number(storeId), type, name, code, isActive: !!isActive },
    });
    res.json({ message: "İstasyon eklendi", station: created });
  } catch (e) {
    if (e.code === "P2002") return res.status(409).json({ message: "Bu barkod/kod zaten bu mağazada kayıtlı." });
    console.error("POST /stations", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

// Güncelle
router.put("/:id", auth, roleCheck(["admin"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { type, name, code, isActive } = req.body;

    const updated = await prisma.station.update({
      where: { id },
      data: {
        ...(type !== undefined ? { type } : {}),
        ...(name !== undefined ? { name } : {}),
        ...(code !== undefined ? { code } : {}),
        ...(isActive !== undefined ? { isActive: !!isActive } : {}),
      },
    });
    res.json({ message: "İstasyon güncellendi", station: updated });
  } catch (e) {
    if (e.code === "P2025") return res.status(404).json({ message: "İstasyon bulunamadı" });
    if (e.code === "P2002") return res.status(409).json({ message: "Bu barkod/kod kullanımda." });
    console.error("PUT /stations/:id", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

// Sil
router.delete("/:id", auth, roleCheck(["admin"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.station.delete({ where: { id } });
    res.json({ message: "İstasyon silindi" });
  } catch (e) {
    if (e.code === "P2025") return res.status(404).json({ message: "İstasyon bulunamadı" });
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

export default router;
