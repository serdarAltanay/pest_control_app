// src/routes/stations.js
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { auth, roleCheck } from "../middleware/auth.js";

const prisma = new PrismaClient();

/** Helpers */
function parseId(val) {
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Artık latitude/longitude yok
function pickStationPayload(body) {
  const payload = {};
  if ("type" in body)        payload.type = String(body.type);
  if ("name" in body)        payload.name = String(body.name).trim();
  if ("code" in body)        payload.code = String(body.code).trim();
  if ("isActive" in body)    payload.isActive = !!body.isActive;
  if ("zone" in body)        payload.zone = body.zone ? String(body.zone).trim() : null;
  if ("description" in body) payload.description = body.description ? String(body.description).trim() : null;
  return payload;
}

/** DÜZ ROUTER (/api/stations) */
export const stationsRouter = Router();

// GET /api/stations/store/:storeId
stationsRouter.get(
  "/store/:storeId",
  auth, roleCheck(["admin", "employee"]),
  async (req, res) => {
    try {
      const storeId = parseId(req.params.storeId);
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
  }
);

// GET /api/stations/metrics/store/:storeId
stationsRouter.get(
  "/metrics/store/:storeId",
  auth, roleCheck(["admin", "employee"]),
  async (req, res) => {
    try {
      const storeId = parseId(req.params.storeId);
      if (!storeId) return res.status(400).json({ message: "Geçersiz storeId" });

      const list = await prisma.station.groupBy({
        by: ["type"],
        where: { storeId, isActive: true },
        _count: { type: true },
      });

      const all = ["FARE_YEMLEME","CANLI_YAKALAMA","ELEKTRIKLI_SINEK_TUTUCU","BOCEK_MONITOR","GUVE_TUZAGI"];
      const data = Object.fromEntries(all.map(t => [t, 0]));
      for (const r of list) data[r.type] = r._count.type;

      res.json(data);
    } catch (e) {
      console.error("GET /stations/metrics/store/:storeId", e);
      res.status(500).json({ message: "Sunucu hatası" });
    }
  }
);

// GET /api/stations/:id
stationsRouter.get(
  "/:id",
  auth, roleCheck(["admin", "employee"]),
  async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ message: "Geçersiz id" });

      const item = await prisma.station.findUnique({ where: { id } });
      if (!item) return res.status(404).json({ message: "Bulunamadı" });
      res.json(item);
    } catch (e) {
      console.error("GET /stations/:id", e);
      res.status(500).json({ message: "Sunucu hatası" });
    }
  }
);

// POST /api/stations
stationsRouter.post(
  "/",
  auth, roleCheck(["admin"]),
  async (req, res) => {
    try {
      const sid = parseId(req.body?.storeId);
      if (!sid) return res.status(400).json({ message: "Geçersiz storeId" });

      const store = await prisma.store.findUnique({ where: { id: sid } });
      if (!store) return res.status(404).json({ message: "Mağaza bulunamadı" });

      const data = pickStationPayload(req.body);
      if (!data.type || !data.name || !data.code) {
        return res.status(400).json({ message: "type, name, code zorunlu." });
      }
      if (!("isActive" in data)) data.isActive = true;

      const created = await prisma.station.create({
        data: { ...data, storeId: sid },
      });
      res.json({ message: "İstasyon eklendi", station: created });
    } catch (e) {
      if (e.code === "P2002") {
        return res.status(409).json({ message: "Bu barkod/kod zaten bu mağazada kayıtlı." });
      }
      console.error("POST /stations", e);
      res.status(500).json({ message: "Sunucu hatası" });
    }
  }
);

// PUT /api/stations/:id
stationsRouter.put(
  "/:id",
  auth, roleCheck(["admin"]),
  async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ message: "Geçersiz id" });

      const data = pickStationPayload(req.body);
      const updated = await prisma.station.update({ where: { id }, data });
      res.json({ message: "İstasyon güncellendi", station: updated });
    } catch (e) {
      if (e.code === "P2025") return res.status(404).json({ message: "İstasyon bulunamadı" });
      if (e.code === "P2002") return res.status(409).json({ message: "Bu barkod/kod kullanımda." });
      console.error("PUT /stations/:id", e);
      res.status(500).json({ message: "Sunucu hatası" });
    }
  }
);

// DELETE /api/stations/:id
stationsRouter.delete(
  "/:id",
  auth, roleCheck(["admin"]),
  async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ message: "Geçersiz id" });

      await prisma.station.delete({ where: { id } });
      res.json({ message: "İstasyon silindi" });
    } catch (e) {
      if (e.code === "P2025") return res.status(404).json({ message: "İstasyon bulunamadı" });
      console.error("DELETE /stations/:id", e);
      res.status(500).json({ message: "Sunucu hatası" });
    }
  }
);


/** NESTED ROUTER (/api/stores/:storeId/stations ...) */
export const stationsNestedRouter = Router();

// GET /api/stores/:storeId/stations
stationsNestedRouter.get(
  "/stores/:storeId/stations",
  auth, roleCheck(["admin", "employee"]),
  async (req, res) => {
    try {
      const storeId = parseId(req.params.storeId);
      if (!storeId) return res.status(400).json({ message: "Geçersiz storeId" });
      const items = await prisma.station.findMany({
        where: { storeId },
        orderBy: { createdAt: "desc" },
      });
      res.json(items);
    } catch (e) {
      console.error("GET /stores/:storeId/stations", e);
      res.status(500).json({ message: "Sunucu hatası" });
    }
  }
);

// GET /api/stores/:storeId/stations/metrics
stationsNestedRouter.get(
  "/stores/:storeId/stations/metrics",
  auth, roleCheck(["admin", "employee"]),
  async (req, res) => {
    try {
      const storeId = parseId(req.params.storeId);
      if (!storeId) return res.status(400).json({ message: "Geçersiz storeId" });

      const list = await prisma.station.groupBy({
        by: ["type"],
        where: { storeId, isActive: true },
        _count: { type: true },
      });

      const all = ["FARE_YEMLEME","CANLI_YAKALAMA","ELEKTRIKLI_SINEK_TUTUCU","BOCEK_MONITOR","GUVE_TUZAGI"];
      const data = Object.fromEntries(all.map(t => [t, 0]));
      for (const r of list) data[r.type] = r._count.type;

      res.json(data);
    } catch (e) {
      console.error("GET /stores/:storeId/stations/metrics", e);
      res.status(500).json({ message: "Sunucu hatası" });
    }
  }
);

// POST /api/stores/:storeId/stations
stationsNestedRouter.post(
  "/stores/:storeId/stations",
  auth, roleCheck(["admin"]),
  async (req, res) => {
    try {
      const storeId = parseId(req.params.storeId);
      if (!storeId) return res.status(400).json({ message: "Geçersiz storeId" });

      const store = await prisma.store.findUnique({ where: { id: storeId } });
      if (!store) return res.status(404).json({ message: "Mağaza bulunamadı" });

      const data = pickStationPayload(req.body);
      if (!data.type || !data.name || !data.code) {
        return res.status(400).json({ message: "type, name, code zorunlu." });
      }
      if (!("isActive" in data)) data.isActive = true;

      const created = await prisma.station.create({
        data: { ...data, storeId },
      });
      res.json({ message: "İstasyon eklendi", station: created });
    } catch (e) {
      if (e.code === "P2002") {
        return res.status(409).json({ message: "Bu barkod/kod zaten bu mağazada kayıtlı." });
      }
      console.error("POST /stores/:storeId/stations", e);
      res.status(500).json({ message: "Sunucu hatası" });
    }
  }
);

// PUT /api/stores/:storeId/stations/:stationId
stationsNestedRouter.put(
  "/stores/:storeId/stations/:stationId",
  auth, roleCheck(["admin"]),
  async (req, res) => {
    try {
      const stationId = parseId(req.params.stationId);
      if (!stationId) return res.status(400).json({ message: "Geçersiz stationId" });

      const data = pickStationPayload(req.body);
      const updated = await prisma.station.update({
        where: { id: stationId },
        data,
      });
      res.json({ message: "İstasyon güncellendi", station: updated });
    } catch (e) {
      if (e.code === "P2025") return res.status(404).json({ message: "İstasyon bulunamadı" });
      if (e.code === "P2002") return res.status(409).json({ message: "Bu barkod/kod kullanımda." });
      console.error("PUT /stores/:storeId/stations/:stationId", e);
      res.status(500).json({ message: "Sunucu hatası" });
    }
  }
);

// DELETE /api/stores/:storeId/stations/:stationId
stationsNestedRouter.delete(
  "/stores/:storeId/stations/:stationId",
  auth, roleCheck(["admin"]),
  async (req, res) => {
    try {
      const stationId = parseId(req.params.stationId);
      if (!stationId) return res.status(400).json({ message: "Geçersiz stationId" });

      await prisma.station.delete({ where: { id: stationId } });
      res.json({ message: "İstasyon silindi" });
    } catch (e) {
      if (e.code === "P2025") return res.status(404).json({ message: "İstasyon bulunamadı" });
      console.error("DELETE /stores/:storeId/stations/:stationId", e);
      res.status(500).json({ message: "Sunucu hatası" });
    }
  }
);
