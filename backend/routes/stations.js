// routes/stations.js
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { auth, roleCheck } from "../middleware/auth.js";

const prisma = new PrismaClient();

/** Helpers */
function parseId(val) {
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Çalışan erişim kontrolü (kendi müşterileri)
async function ensureEmployeeStoreAccess(req, storeId) {
  if (req.user?.role !== "employee") return true;
  const ok = await prisma.store.findFirst({
    where: { id: storeId, customer: { employeeId: req.user.id } },
    select: { id: true },
  });
  return !!ok;
}

// Customer (AccessOwner) grant kontrolü
// routes/stations.js VE src/routes/activations.js içindeki aynı yardımcı fonksiyon
async function customerHasStoreAccess(req, storeId) {
  if (["admin", "employee"].includes(req.user?.role)) return true;
  if (req.user?.role !== "customer") return false;

  const ownerId = Number(req.user.id);
  if (!Number.isFinite(ownerId) || ownerId <= 0) return false;

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { customerId: true },
  });
  if (!store) return false;

  // AccessGrant modeli yoksa veya çağrı başarısız olursa fallback: store.customerId === ownerId
  try {
    // prisma.accessGrant bazı şemalarda olmayabilir
    if (!prisma.accessGrant || !prisma.accessGrant.findFirst) {
      return store.customerId === ownerId;
    }

    const grant = await prisma.accessGrant.findFirst({
      where: {
        ownerId,
        OR: [
          { scopeType: "STORE", storeId },
          { scopeType: "CUSTOMER", customerId: store.customerId },
        ],
      },
      select: { id: true },
    });
    return !!grant || store.customerId === ownerId;
  } catch (err) {
    console.error("customerHasStoreAccess fallback:", err);
    return store.customerId === ownerId;
  }
}


// Artık latitude/longitude yok
function pickStationPayload(body) {
  const payload = {};
  if ("type" in body) payload.type = String(body.type);
  if ("name" in body) payload.name = String(body.name).trim();
  if ("code" in body) payload.code = String(body.code).trim();
  if ("isActive" in body) payload.isActive = !!body.isActive;
  if ("zone" in body) payload.zone = body.zone ? String(body.zone).trim() : null;
  if ("description" in body) payload.description = body.description ? String(body.description).trim() : null;
  return payload;
}

/** DÜZ ROUTER (/api/stations) */
export const stationsRouter = Router();

// GET /api/stations/store/:storeId  (müşteriye read-only)
stationsRouter.get(
  "/store/:storeId",
  auth, roleCheck(["admin", "employee", "customer"]),
  async (req, res) => {
    try {
      const storeId = parseId(req.params.storeId);
      if (!storeId) return res.status(400).json({ message: "Geçersiz storeId" });

      if (req.user.role === "employee") {
        const ok = await ensureEmployeeStoreAccess(req, storeId);
        if (!ok) return res.status(403).json({ message: "Erişim yok" });
      } else if (req.user.role === "customer") {
        const ok = await customerHasStoreAccess(req, storeId);
        if (!ok) return res.status(403).json({ message: "Yetkisiz" });
      }

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

// GET /api/stations/metrics/store/:storeId  (müşteriye açık)
stationsRouter.get(
  "/metrics/store/:storeId",
  auth, roleCheck(["admin", "employee", "customer"]),
  async (req, res) => {
    try {
      const storeId = parseId(req.params.storeId);
      if (!storeId) return res.status(400).json({ message: "Geçersiz storeId" });

      if (req.user.role === "employee") {
        const ok = await ensureEmployeeStoreAccess(req, storeId);
        if (!ok) return res.status(403).json({ message: "Erişim yok" });
      } else if (req.user.role === "customer") {
        const ok = await customerHasStoreAccess(req, storeId);
        if (!ok) return res.status(403).json({ message: "Yetkisiz" });
      }

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

// GET /api/stations/:id  (müşteriye read-only + erişim kontrolü)
stationsRouter.get(
  "/:id",
  auth, roleCheck(["admin", "employee", "customer"]),
  async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ message: "Geçersiz id" });

      // 1) Önce sadece storeId çek → erişim kontrolü
      const head = await prisma.station.findUnique({
        where: { id },
        select: { storeId: true },
      });
      if (!head) return res.status(404).json({ message: "Bulunamadı" });

      if (req.user.role === "employee") {
        const ok = await ensureEmployeeStoreAccess(req, head.storeId);
        if (!ok) return res.status(403).json({ message: "Erişim yok" });
      } else if (req.user.role === "customer") {
        const ok = await customerHasStoreAccess(req, head.storeId);
        if (!ok) return res.status(403).json({ message: "Yetkisiz" });
      }

      // 2) Tüm alanları getir (select’siz → şemada olmayan alan hatası riskini sıfırlar)
      const item = await prisma.station.findUnique({ where: { id } });
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
      if (!data.type || !data.name || !data.code) return res.status(400).json({ message: "type, name, code zorunlu." });
      if (!("isActive" in data)) data.isActive = true;

      const created = await prisma.station.create({ data: { ...data, storeId: sid } });
      res.json({ message: "İstasyon eklendi", station: created });
    } catch (e) {
      if (e.code === "P2002") return res.status(409).json({ message: "Bu barkod/kod zaten bu mağazada kayıtlı." });
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

// GET /api/stores/:storeId/stations  (müşteriye read-only)
stationsNestedRouter.get(
  "/:storeId/stations",
  auth, roleCheck(["admin", "employee", "customer"]),
  async (req, res) => {
    try {
      const storeId = parseId(req.params.storeId);
      if (!storeId) return res.status(400).json({ message: "Geçersiz storeId" });

      if (req.user.role === "employee") {
        const ok = await ensureEmployeeStoreAccess(req, storeId);
        if (!ok) return res.status(403).json({ message: "Erişim yok" });
      } else if (req.user.role === "customer") {
        const ok = await customerHasStoreAccess(req, storeId);
        if (!ok) return res.status(403).json({ message: "Yetkisiz" });
      }

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

// GET /api/stores/:storeId/stations/metrics  (müşteriye açık)
stationsNestedRouter.get(
  "/:storeId/stations/metrics",
  auth, roleCheck(["admin", "employee", "customer"]),
  async (req, res) => {
    try {
      const storeId = parseId(req.params.storeId);
      if (!storeId) return res.status(400).json({ message: "Geçersiz storeId" });

      if (req.user.role === "employee") {
        const ok = await ensureEmployeeStoreAccess(req, storeId);
        if (!ok) return res.status(403).json({ message: "Erişim yok" });
      } else if (req.user.role === "customer") {
        const ok = await customerHasStoreAccess(req, storeId);
        if (!ok) return res.status(403).json({ message: "Yetkisiz" });
      }

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

// GET /api/stores/:storeId/stations/:stationId  (müşteriye read-only tekil)
stationsNestedRouter.get(
  "/:storeId/stations/:stationId",
  auth, roleCheck(["admin","employee","customer"]),
  async (req,res)=>{
    try {
      const storeId = parseId(req.params.storeId);
      const stationId = parseId(req.params.stationId);
      if(!storeId || !stationId) return res.status(400).json({message:"Geçersiz id"});

      if (req.user.role === "employee") {
        const ok = await ensureEmployeeStoreAccess(req, storeId);
        if (!ok) return res.status(403).json({ message: "Erişim yok" });
      } else if (req.user.role === "customer") {
        const ok = await customerHasStoreAccess(req, storeId);
        if (!ok) return res.status(403).json({ message: "Yetkisiz" });
      }

      const item = await prisma.station.findFirst({
        where:{ id: stationId, storeId },
        select:{ id:true, storeId:true, type:true, name:true, code:true, isActive:true, zone:true, description:true, createdAt:true, updatedAt:true }
      });
      if(!item) return res.status(404).json({message:"Bulunamadı"});
      res.json(item);
    } catch(e){
      console.error("GET /stores/:storeId/stations/:stationId", e);
      res.status(500).json({message:"Sunucu hatası"});
    }
  }
);

// POST /api/stores/:storeId/stations (admin)
stationsNestedRouter.post(
  "/:storeId/stations",
  auth, roleCheck(["admin"]),
  async (req, res) => {
    try {
      const storeId = parseId(req.params.storeId);
      if (!storeId) return res.status(400).json({ message: "Geçersiz storeId" });

      const store = await prisma.store.findUnique({ where: { id: storeId } });
      if (!store) return res.status(404).json({ message: "Mağaza bulunamadı" });

      const data = pickStationPayload(req.body);
      if (!data.type || !data.name || !data.code) return res.status(400).json({ message: "type, name, code zorunlu." });
      if (!("isActive" in data)) data.isActive = true;

      const created = await prisma.station.create({ data: { ...data, storeId } });
      res.json({ message: "İstasyon eklendi", station: created });
    } catch (e) {
      if (e.code === "P2002") return res.status(409).json({ message: "Bu barkod/kod zaten bu mağazada kayıtlı." });
      console.error("POST /stores/:storeId/stations", e);
      res.status(500).json({ message: "Sunucu hatası" });
    }
  }
);

// PUT /api/stores/:storeId/stations/:stationId (admin)
stationsNestedRouter.put(
  "/:storeId/stations/:stationId",
  auth, roleCheck(["admin"]),
  async (req, res) => {
    try {
      const stationId = parseId(req.params.stationId);
      if (!stationId) return res.status(400).json({ message: "Geçersiz stationId" });

      const data = pickStationPayload(req.body);
      const updated = await prisma.station.update({ where: { id: stationId }, data });
      res.json({ message: "İstasyon güncellendi", station: updated });
    } catch (e) {
      if (e.code === "P2025") return res.status(404).json({ message: "İstasyon bulunamadı" });
      if (e.code === "P2002") return res.status(409).json({ message: "Bu barkod/kod kullanımda." });
      console.error("PUT /stores/:storeId/stations/:stationId", e);
      res.status(500).json({ message: "Sunucu hatası" });
    }
  }
);

// DELETE /api/stores/:storeId/stations/:stationId (admin)
stationsNestedRouter.delete(
  "/:storeId/stations/:stationId",
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
