// routes/activations.js
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { auth, roleCheck } from "../middleware/auth.js";

const prisma = new PrismaClient();
const router = Router();

/** Helpers */
const parseId = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };
const parseISO = (v) => { if (!v) return null; const d = new Date(v); return Number.isFinite(+d) ? d : null; };
const parseLimit = (v, def=20, max=200) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(n, max);
};
const parseOffset = (v, def=0) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : def;
};

// Employee → her mağazaya/istasyona sınırsız
async function ensureEmployeeStoreAccess(req, storeId) {
  return true;
}

// Customer (AccessOwner) grant kontrolü (okuma için)
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
  return !!grant;
}

/** ---------------- LISTE: STATION ----------------
 * GET /api/activations/stations/:stationId?limit&offset&from&to&type&risk&activity=0|1
 * admin/employee/customer
 */
router.get("/stations/:stationId", auth, roleCheck(["admin","employee","customer"]), async (req,res)=>{
  try{
    const stationId = parseId(req.params.stationId);
    if(!stationId) return res.status(400).json({message:"Geçersiz stationId"});

    const st = await prisma.station.findUnique({ where: { id: stationId }, select:{ storeId:true }});
    if(!st) return res.status(404).json({message:"İstasyon bulunamadı"});

    if (req.user.role === "customer") {
      const ok = await customerHasStoreAccess(req, st.storeId);
      if (!ok) return res.status(403).json({ message: "Yetkisiz" });
    }
    // employee/admin → serbest

    const limit = parseLimit(req.query.limit, 20);
    const offset = parseOffset(req.query.offset, 0);
    const from = parseISO(req.query.from);
    const to   = parseISO(req.query.to);
    const type = req.query.type ? String(req.query.type) : undefined;
    const risk = req.query.risk ? String(req.query.risk) : undefined;
    const activity = (req.query.activity === "0" || req.query.activity === "1")
      ? req.query.activity === "1"
      : undefined;

    const where = {
      stationId,
      ...(from || to ? { observedAt: {
        ...(from ? { gte: from } : {}),
        ...(to   ? { lte: to }   : {}),
      }} : {}),
      ...(type ? { type } : {}),
      ...(risk ? { risk } : {}),
      ...(activity !== undefined ? { aktiviteVar: activity } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.stationActivation.findMany({
        where, orderBy: { observedAt: "desc" }, skip: offset, take: limit
      }),
      prisma.stationActivation.count({ where })
    ]);

    res.json({ total, limit, offset, items: rows });
  }catch(e){
    console.error("GET /activations/stations/:stationId", e);
    res.status(500).json({message:"Sunucu hatası"});
  }
});

/** ---------------- LISTE: STORE ----------------
 * GET /api/activations/stores/:storeId?limit&offset&from&to&type&risk&activity=0|1
 * admin/employee/customer
 */
router.get("/stores/:storeId", auth, roleCheck(["admin","employee","customer"]), async (req,res)=>{
  try{
    const storeId = parseId(req.params.storeId);
    if(!storeId) return res.status(400).json({message:"Geçersiz storeId"});

    if (req.user.role === "customer") {
      const ok = await customerHasStoreAccess(req, storeId);
      if (!ok) return res.status(403).json({ message: "Yetkisiz" });
    }
    // employee/admin → serbest

    const limit = parseLimit(req.query.limit, 20);
    const offset = parseOffset(req.query.offset, 0);
    const from = parseISO(req.query.from);
    const to   = parseISO(req.query.to);
    const type = req.query.type ? String(req.query.type) : undefined;
    const risk = req.query.risk ? String(req.query.risk) : undefined;
    const activity = (req.query.activity === "0" || req.query.activity === "1")
      ? req.query.activity === "1"
      : undefined;

    const where = {
      storeId,
      ...(from || to ? { observedAt: {
        ...(from ? { gte: from } : {}),
        ...(to   ? { lte: to }   : {}),
      }} : {}),
      ...(type ? { type } : {}),
      ...(risk ? { risk } : {}),
      ...(activity !== undefined ? { aktiviteVar: activity } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.stationActivation.findMany({
        where, orderBy: { observedAt: "desc" }, skip: offset, take: limit
      }),
      prisma.stationActivation.count({ where })
    ]);

    res.json({ total, limit, offset, items: rows });
  }catch(e){
    console.error("GET /activations/stores/:storeId", e);
    res.status(500).json({message:"Sunucu hatası"});
  }
});

/** ---------------- GET ONE ----------------
 * GET /api/activations/:id
 * admin/employee/customer (customer grant: activation.storeId üzerinden)
 */
router.get("/:id", auth, roleCheck(["admin","employee","customer"]), async (req,res)=>{
  try{
    const id = parseId(req.params.id);
    if(!id) return res.status(400).json({message:"Geçersiz id"});

    const act = await prisma.stationActivation.findUnique({ where: { id }});
    if(!act) return res.status(404).json({message:"Bulunamadı"});

    if (req.user.role === "customer") {
      const ok = await customerHasStoreAccess(req, act.storeId);
      if (!ok) return res.status(403).json({ message: "Yetkisiz" });
    }
    // employee/admin → serbest

    res.json(act);
  }catch(e){
    console.error("GET /activations/:id", e);
    res.status(500).json({message:"Sunucu hatası"});
  }
});

/** ---------------- CREATE ----------------
 * POST /api/activations
 * body: { stationId, storeId?, type, risk, aktiviteVar, observedAt?, notes? }
 * admin/employee
 */
router.post("/", auth, roleCheck(["admin","employee"]), async (req,res)=>{
  try{
    const stationId = parseId(req.body?.stationId);
    if(!stationId) return res.status(400).json({message:"stationId zorunlu"});

    const st = await prisma.station.findUnique({
      where: { id: stationId }, select: { id:true, storeId:true }
    });
    if(!st) return res.status(404).json({message:"İstasyon bulunamadı"});

    const payload = {
      stationId: st.id,
      storeId: st.storeId,
      type: String(req.body?.type || ""),
      risk: String(req.body?.risk || ""),
      aktiviteVar: !!req.body?.aktiviteVar,
      observedAt: parseISO(req.body?.observedAt) || new Date(),
      notes: req.body?.notes ? String(req.body.notes).trim() : null,
    };
    if (!payload.type || !payload.risk)
      return res.status(400).json({message:"type ve risk zorunlu"});

    const created = await prisma.stationActivation.create({ data: payload });
    res.json({ message: "Aktivasyon eklendi", activation: created });
  }catch(e){
    console.error("POST /activations", e);
    res.status(500).json({message:"Sunucu hatası"});
  }
});

/** ---------------- UPDATE ----------------
 * PUT /api/activations/:id
 * admin/employee
 */
router.put("/:id", auth, roleCheck(["admin","employee"]), async (req,res)=>{
  try{
    const id = parseId(req.params.id);
    if(!id) return res.status(400).json({message:"Geçersiz id"});

    const old = await prisma.stationActivation.findUnique({ where: { id }});
    if(!old) return res.status(404).json({message:"Bulunamadı"});

    const data = {};
    if ("type" in req.body) data.type = String(req.body.type);
    if ("risk" in req.body) data.risk = String(req.body.risk);
    if ("aktiviteVar" in req.body) data.aktiviteVar = !!req.body.aktiviteVar;
    if ("observedAt" in req.body) {
      const d = parseISO(req.body.observedAt);
      if (!d) return res.status(400).json({message:"observedAt geçersiz"});
      data.observedAt = d;
    }
    if ("notes" in req.body) data.notes = req.body.notes ? String(req.body.notes).trim() : null;

    const updated = await prisma.stationActivation.update({ where: { id }, data });
    res.json({ message: "Aktivasyon güncellendi", activation: updated });
  }catch(e){
    if (e.code === "P2025") return res.status(404).json({message:"Bulunamadı"});
    console.error("PUT /activations/:id", e);
    res.status(500).json({message:"Sunucu hatası"});
  }
});

/** ---------------- DELETE ----------------
 * DELETE /api/activations/:id
 * admin/employee
 */
router.delete("/:id", auth, roleCheck(["admin","employee"]), async (req,res)=>{
  try{
    const id = parseId(req.params.id);
    if(!id) return res.status(400).json({message:"Geçersiz id"});

    await prisma.stationActivation.delete({ where: { id }});
    res.json({ message: "Aktivasyon silindi" });
  }catch(e){
    if (e.code === "P2025") return res.status(404).json({message:"Bulunamadı"});
    console.error("DELETE /activations/:id", e);
    res.status(500).json({message:"Sunucu hatası"});
  }
});

export default router;
