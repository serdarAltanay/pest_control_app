// src/routes/activations.js
import { Router } from "express";
import { PrismaClient, Prisma } from "@prisma/client";
import { auth, roleCheck } from "../middleware/auth.js";

const prisma = new PrismaClient();
const router = Router();

/** helpers */
const parseId = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };
const BOOL = (v) => typeof v === "boolean" ? v : v === "true" ? true : v === "false" ? false : undefined;
const INT  = (v) => (v === "" || v == null) ? undefined : (Number.isFinite(+v) ? Math.max(0, Math.trunc(+v)) : undefined);
const RISK = new Set(["RISK_YOK", "DUSUK", "ORTA", "YUKSEK"]);

function buildActivationData(body, stationType) {
  const type = String(body?.type || stationType);
  const risk = RISK.has(String(body?.risk)) ? String(body.risk) : "RISK_YOK";
  const out = {
    type,
    aktiviteVar: BOOL(body?.aktiviteVar),
    risk,
    notes: body?.notes ? String(body.notes).slice(0, 1000) : undefined,
  };

  if (type === "FARE_YEMLEME") {
    Object.assign(out, {
      deformeYem: BOOL(body?.deformeYem),
      yemDegisti: BOOL(body?.yemDegisti),
      deformeMonitor: BOOL(body?.deformeMonitor),
      monitorDegisti: BOOL(body?.monitorDegisti),
      ulasilamayanMonitor: BOOL(body?.ulasilamayanMonitor),
    });
  }
  if (type === "CANLI_YAKALAMA") {
    Object.assign(out, {
      deformeMonitor: BOOL(body?.deformeMonitor),
      yapiskanDegisti: BOOL(body?.yapiskanDegisti),
      monitorDegisti: BOOL(body?.monitorDegisti),
      ulasilamayanMonitor: BOOL(body?.ulasilamayanMonitor),
    });
  }
  if (type === "ELEKTRIKLI_SINEK_TUTUCU") {
    Object.assign(out, {
      sariBantDegisim: BOOL(body?.sariBantDegisim),
      arizaliEFK: BOOL(body?.arizaliEFK),
      tamirdeEFK: BOOL(body?.tamirdeEFK),
      uvLambaDegisim: BOOL(body?.uvLambaDegisim),
      uvLambaAriza: BOOL(body?.uvLambaAriza),
      ulasilamayanMonitor: BOOL(body?.ulasilamayanMonitor),
      karasinek: INT(body?.karasinek),
      sivrisinek: INT(body?.sivrisinek),
      diger: INT(body?.diger),
    });
  }
  if (type === "BOCEK_MONITOR") {
    Object.assign(out, {
      monitorDegisti: BOOL(body?.monitorDegisti),
      hedefZararliSayisi: INT(body?.hedefZararliSayisi),
    });
  }
  if (type === "GUVE_TUZAGI") {
    Object.assign(out, {
      feromonDegisti: BOOL(body?.feromonDegisti),
      deformeTuzak: BOOL(body?.deformeTuzak),
      tuzakDegisti: BOOL(body?.tuzakDegisti),
      ulasilamayanTuzak: BOOL(body?.ulasilamayanTuzak),
      guve: INT(body?.guve),
      diger: INT(body?.diger),
    });
  }

  // otomatik aktiviteVar türetimi
  if (out.aktiviteVar === undefined) {
    const anyCount =
      (out.karasinek || 0) + (out.sivrisinek || 0) + (out.diger || 0) +
      (out.guve || 0) + (out.hedefZararliSayisi || 0);
    if (anyCount > 0) out.aktiviteVar = true;
  }

  try { out.data = body && typeof body === "object" ? body : undefined; } catch {}
  return out;
}

/* ---------------- CREATE ---------------- */

// POST /api/activations/stations/:stationId
router.post(
  "/stations/:stationId",
  auth, roleCheck(["admin", "employee"]),
  async (req, res) => {
    try {
      const stationId = parseId(req.params.stationId);
      if (!stationId) return res.status(400).json({ message: "Geçersiz stationId" });

      const station = await prisma.station.findUnique({ where: { id: stationId } });
      if (!station) return res.status(404).json({ message: "İstasyon bulunamadı" });

      const payload = buildActivationData(req.body, station.type);
      const created = await prisma.stationActivation.create({
        data: {
          storeId: station.storeId,
          stationId,
          type: station.type,
          observedAt: new Date(),
          ...payload,
        },
      });
      res.json({ message: "Aktivasyon kaydedildi", activation: created });
    } catch (e) {
      console.error("POST /activations/stations/:stationId", e);
      res.status(500).json({ message: "Sunucu hatası" });
    }
  }
);

// POST /api/activations/visits/:visitId/stations/:stationId
router.post(
  "/visits/:visitId/stations/:stationId",
  auth, roleCheck(["admin", "employee"]),
  async (req, res) => {
    try {
      const visitId = parseId(req.params.visitId);
      const stationId = parseId(req.params.stationId);
      if (!visitId || !stationId) return res.status(400).json({ message: "Geçersiz id" });

      const [visit, station] = await Promise.all([
        prisma.visit.findUnique({ where: { id: visitId } }),
        prisma.station.findUnique({ where: { id: stationId } }),
      ]);
      if (!visit) return res.status(404).json({ message: "Ziyaret bulunamadı" });
      if (!station) return res.status(404).json({ message: "İstasyon bulunamadı" });
      if (visit.storeId !== station.storeId) {
        return res.status(409).json({ message: "Ziyaret ile istasyon farklı mağazalara ait" });
      }

      const payload = buildActivationData(req.body, station.type);
      const created = await prisma.stationActivation.create({
        data: {
          storeId: station.storeId,
          stationId,
          visitId,
          type: station.type,
          observedAt: visit.date ?? new Date(),
          ...payload,
        },
      });
      res.json({ message: "Aktivasyon kaydedildi", activation: created });
    } catch (e) {
      console.error("POST /activations/visits/:visitId/stations/:stationId", e);
      res.status(500).json({ message: "Sunucu hatası" });
    }
  }
);

/* ---------------- READ ---------------- */

// GET /api/activations/stations/:stationId?limit=20&offset=0
router.get(
  "/stations/:stationId",
  auth, roleCheck(["admin", "employee"]),
  async (req, res) => {
    try {
      const stationId = parseId(req.params.stationId);
      if (!stationId) return res.status(400).json({ message: "Geçersiz stationId" });

      const take = Math.min(parseInt(req.query.limit ?? "20"), 100);
      const skip = Math.max(parseInt(req.query.offset ?? "0"), 0);

      const [items, total] = await Promise.all([
        prisma.stationActivation.findMany({
          where: { stationId },
          orderBy: { observedAt: "desc" },
          skip, take,
        }),
        prisma.stationActivation.count({ where: { stationId } }),
      ]);
      res.json({ total, items });
    } catch (e) {
      console.error("GET /activations/stations/:stationId", e);
      res.status(500).json({ message: "Sunucu hatası" });
    }
  }
);

// GET /api/activations/:id
router.get(
  "/:id",
  auth, roleCheck(["admin", "employee"]),
  async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ message: "Geçersiz id" });

      const item = await prisma.stationActivation.findUnique({ where: { id } });
      if (!item) return res.status(404).json({ message: "Bulunamadı" });
      res.json(item);
    } catch (e) {
      console.error("GET /activations/:id", e);
      res.status(500).json({ message: "Sunucu hatası" });
    }
  }
);

// GET /api/activations/stations/:stationId/last
router.get(
  "/stations/:stationId/last",
  auth, roleCheck(["admin", "employee"]),
  async (req, res) => {
    try {
      const stationId = parseId(req.params.stationId);
      if (!stationId) return res.status(400).json({ message: "Geçersiz stationId" });

      const last = await prisma.stationActivation.findFirst({
        where: { stationId },
        orderBy: { observedAt: "desc" },
      });
      res.json(last || null);
    } catch (e) {
      console.error("GET /activations/stations/:stationId/last", e);
      res.status(500).json({ message: "Sunucu hatası" });
    }
  }
);

// GET /api/activations/stores/:storeId/last
// => { [stationId]: activation }
router.get(
  "/stores/:storeId/last",
  auth, roleCheck(["admin", "employee"]),
  async (req, res) => {
    try {
      const storeId = parseId(req.params.storeId);
      if (!storeId) return res.status(400).json({ message: "Geçersiz storeId" });

      const list = await prisma.stationActivation.findMany({
        where: { storeId },
        orderBy: { observedAt: "desc" },
        select: {
          id: true, stationId: true, type: true, aktiviteVar: true, risk: true,
          observedAt: true, karasinek: true, sivrisinek: true, diger: true,
          guve: true, hedefZararliSayisi: true,
        },
      });

      const map = {};
      for (const a of list) if (!map[a.stationId]) map[a.stationId] = a;
      res.json(map);
    } catch (e) {
      console.error("GET /activations/stores/:storeId/last", e);
      res.status(500).json({ message: "Sunucu hatası" });
    }
  }
);

/* --------------- UPDATE / DELETE --------------- */

// PUT /api/activations/:id
router.put(
  "/:id",
  auth, roleCheck(["admin", "employee"]),
  async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ message: "Geçersiz id" });

      const current = await prisma.stationActivation.findUnique({ where: { id } });
      if (!current) return res.status(404).json({ message: "Bulunamadı" });

      const payload = buildActivationData(req.body, current.type);
      const updated = await prisma.stationActivation.update({
        where: { id },
        data: { ...payload },
      });
      res.json({ message: "Aktivasyon güncellendi", activation: updated });
    } catch (e) {
      console.error("PUT /activations/:id", e);
      res.status(500).json({ message: "Sunucu hatası" });
    }
  }
);

// DELETE /api/activations/:id
router.delete(
  "/:id",
  auth, roleCheck(["admin"]),
  async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ message: "Geçersiz id" });

      await prisma.stationActivation.delete({ where: { id } });
      res.json({ message: "Aktivasyon silindi" });
    } catch (e) {
      if (e.code === "P2025") return res.status(404).json({ message: "Bulunamadı" });
      console.error("DELETE /activations/:id", e);
      res.status(500).json({ message: "Sunucu hatası" });
    }
  }
);

export default router;
