// routes/activations.js
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { auth, roleCheck } from "../middleware/auth.js";

const prisma = new PrismaClient();
const router = Router();

/* ───────── helpers ───────── */
const parseId = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };
const parseISO = (v) => { if (!v) return null; const d = new Date(v); return Number.isFinite(+d) ? d : null; };
const parseLimit = (v, def=20, max=200) => { const n = Number(v); return (!Number.isFinite(n) || n<=0) ? def : Math.min(n,max); };
const parseOffset = (v, def=0) => { const n = Number(v); return Number.isFinite(n) && n>=0 ? n : def; };

/* Çalışan için şimdilik serbest (gerekirse sıkılaştırırsın) */
async function ensureEmployeeStoreAccess(_req, _storeId){ return true; }

/* Customer (AccessOwner) → grant kontrolü (okuma) */
async function customerHasStoreAccess(req, storeId) {
  if (["admin", "employee"].includes(req.user?.role)) return true;
  if (req.user?.role !== "customer") return false;

  const ownerId = Number(req.user.id);
  if (!Number.isFinite(ownerId) || ownerId <= 0) return false;

  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { customerId: true } });
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

/* Tip-özgül alanları body’den çek (FARE_YEMLEME) */
function extractRodentBaitExtras(body){
  return {
    deformeYem:           Number(body?.deformeYem) || 0,
    yemDegisti:           Number(body?.yemDegisti) || 0,
    deformeMonitor:       Number(body?.deformeMonitor) || 0,
    monitorDegisti:       Number(body?.monitorDegisti) || 0,
    ulasilamayanMonitor:  Number(body?.ulasilamayanMonitor) || 0,
  };
}

function extractInsectMonitorExtras(body) {
  return {
    deformeMonitor:      Number(body?.deformeMonitor) || 0,
    monitorDegisti:      Number(body?.monitorDegisti) || 0,
    ulasilamayanMonitor: Number(body?.ulasilamayanMonitor) || 0,
  };
}

function extractEfkExtras(body) {
  return {
    sariBantDegisim: Number(body?.sariBantDegisim) || 0,
    arizaliEFK:      Number(body?.arizaliEFK) || 0,
    tamirdeEFK:      Number(body?.tamirdeEFK) || 0,
    uvLambaDegisim:  Number(body?.uvLambaDegisim) || 0,
    uvLambaAriza:    Number(body?.uvLambaAriza) || 0,
    karasinek:       Number(body?.karasinek) || 0,
    sivrisinek:      Number(body?.sivrisinek) || 0,
    diger:           Number(body?.diger) || 0,
  };
}

function extractLiveCatchExtras(body) {
  return {
    aktiviteVar: Number(body?.aktiviteVar) || 0,
  };
}

function extractMothTrapExtras(body) {
  return {
    feromonDegisti:    Number(body?.feromonDegisti) || 0,
    deformeTuzak:      Number(body?.deformeTuzak) || 0,
    tuzakDegisti:      Number(body?.tuzakDegisti) || 0,
    ulasilamayanTuzak: Number(body?.ulasilamayanTuzak) || 0,
    guve:              Number(body?.guve) || 0,
  };
}

/* ───────────────── LISTE: STATION ─────────────────
   GET /api/activations/stations/:stationId?limit&offset&from&to&type&risk&activity=0|1
   admin/employee/customer
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
      ...(from || to ? { observedAt: { ...(from?{ gte: from }:{}), ...(to?{ lte: to }:{}) } } : {}),
      ...(type ? { type } : {}),
      ...(risk ? { risk } : {}),
      ...(activity !== undefined ? { aktiviteVar: activity } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.stationActivation.findMany({ where, orderBy: { observedAt: "desc" }, skip: offset, take: limit }),
      prisma.stationActivation.count({ where })
    ]);

    res.json({ total, limit, offset, items: rows });
  }catch(e){
    console.error("GET /activations/stations/:stationId", e);
    res.status(500).json({message:"Sunucu hatası"});
  }
});

/* ───────────────── LISTE: STORE ─────────────────
   GET /api/activations/stores/:storeId?...
   admin/employee/customer
*/
router.get("/stores/:storeId", auth, roleCheck(["admin","employee","customer"]), async (req,res)=>{
  try{
    const storeId = parseId(req.params.storeId);
    if(!storeId) return res.status(400).json({message:"Geçersiz storeId"});

    if (req.user.role === "customer") {
      const ok = await customerHasStoreAccess(req, storeId);
      if (!ok) return res.status(403).json({ message: "Yetkisiz" });
    }

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
      ...(from || to ? { observedAt: { ...(from?{ gte: from }:{}), ...(to?{ lte: to }:{}) } } : {}),
      ...(type ? { type } : {}),
      ...(risk ? { risk } : {}),
      ...(activity !== undefined ? { aktiviteVar: activity } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.stationActivation.findMany({ where, orderBy: { observedAt: "desc" }, skip: offset, take: limit }),
      prisma.stationActivation.count({ where })
    ]);

    res.json({ total, limit, offset, items: rows });
  }catch(e){
    console.error("GET /activations/stores/:storeId", e);
    res.status(500).json({message:"Sunucu hatası"});
  }
});

/* ───────────────── GET ONE ─────────────────
   GET /api/activations/:id
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

    res.json(act);
  }catch(e){
    console.error("GET /activations/:id", e);
    res.status(500).json({message:"Sunucu hatası"});
  }
});

/* ───────────────── CREATE (GENERIC BODY) ─────────────────
   POST /api/activations
   body: { stationId, type, risk, aktiviteVar, observedAt?, notes?, ...rodentBaitExtras }
   admin/employee
*/
router.post("/", auth, roleCheck(["admin","employee"]), async (req,res)=>{
  try{
    const stationId = parseId(req.body?.stationId);
    if(!stationId) return res.status(400).json({message:"stationId zorunlu"});

    const st = await prisma.station.findUnique({ where: { id: stationId }, select: { id:true, storeId:true } });
    if(!st) return res.status(404).json({message:"İstasyon bulunamadı"});
    if (req.user.role === "employee") await ensureEmployeeStoreAccess(req, st.storeId);

    const base = {
      stationId: st.id,
      storeId: st.storeId,
      type: String(req.body?.type || ""),
      risk: String(req.body?.risk || ""),
      aktiviteVar: Number(req.body?.aktiviteVar) || 0,
      observedAt: parseISO(req.body?.observedAt) || new Date(),
      notes: req.body?.notes ? String(req.body.notes).trim() : null,
    };
    if (!base.type || !base.risk) return res.status(400).json({message:"type ve risk zorunlu"});

    /* Tip-özgül alanlar */
    let extras = {};
    if (base.type === "FARE_YEMLEME") extras = extractRodentBaitExtras(req.body);
    else if (base.type === "BOCEK_MONITOR") extras = extractInsectMonitorExtras(req.body);
    else if (base.type === "ELEKTRIKLI_SINEK_TUTUCU") extras = extractEfkExtras(req.body);
    else if (base.type === "CANLI_YAKALAMA") extras = extractLiveCatchExtras(req.body);
    else if (base.type === "GUVE_TUZAGI") extras = extractMothTrapExtras(req.body);

    const created = await prisma.stationActivation.create({ data: { ...base, ...extras } });
    res.json({ message: "Aktivasyon eklendi", activation: created });
  }catch(e){
    console.error("POST /activations", e);
    res.status(500).json({message:"Sunucu hatası"});
  }
});

/* ───────────────── CREATE (BY STATION) ─────────────────
   POST /api/activations/stations/:stationId
   body: { type, risk, aktiviteVar, observedAt?, notes?, ...rodentBaitExtras }
   admin/employee
*/
router.post("/stations/:stationId", auth, roleCheck(["admin","employee"]), async (req,res)=>{
  try{
    const stationId = parseId(req.params.stationId);
    if(!stationId) return res.status(400).json({message:"Geçersiz stationId"});

    const st = await prisma.station.findUnique({ where: { id: stationId }, select: { id:true, storeId:true } });
    if(!st) return res.status(404).json({message:"İstasyon bulunamadı"});
    if (req.user.role === "employee") await ensureEmployeeStoreAccess(req, st.storeId);

    const base = {
      stationId: st.id,
      storeId: st.storeId,
      type: String(req.body?.type || ""),
      risk: String(req.body?.risk || ""),
      aktiviteVar: Number(req.body?.aktiviteVar) || 0,
      observedAt: parseISO(req.body?.observedAt) || new Date(),
      notes: req.body?.notes ? String(req.body.notes).trim() : null,
    };
    if (!base.type || !base.risk) return res.status(400).json({message:"type ve risk zorunlu"});

    let extras = {};
    if (base.type === "FARE_YEMLEME") extras = extractRodentBaitExtras(req.body);
    else if (base.type === "BOCEK_MONITOR") extras = extractInsectMonitorExtras(req.body);
    else if (base.type === "ELEKTRIKLI_SINEK_TUTUCU") extras = extractEfkExtras(req.body);
    else if (base.type === "CANLI_YAKALAMA") extras = extractLiveCatchExtras(req.body);
    else if (base.type === "GUVE_TUZAGI") extras = extractMothTrapExtras(req.body);

    const created = await prisma.stationActivation.create({ data: { ...base, ...extras } });
    res.json({ message: "Aktivasyon eklendi", activation: created });
  }catch(e){
    console.error("POST /activations/stations/:stationId", e);
    res.status(500).json({message:"Sunucu hatası"});
  }
});

/* ───────────────── CREATE (BY VISIT + STATION) ─────────────────
   POST /api/activations/visits/:visitId/stations/:stationId
   body: { type, risk, aktiviteVar, observedAt?, notes?, ...rodentBaitExtras }
   Ziyarete bağlar (visitId sütunun varsa doldurur).
   admin/employee
*/
router.post("/visits/:visitId/stations/:stationId", auth, roleCheck(["admin","employee"]), async (req,res)=>{
  try{
    const visitId = parseId(req.params.visitId);
    const stationId = parseId(req.params.stationId);
    if(!visitId || !stationId) return res.status(400).json({message:"Geçersiz id"});

    const [visit, station] = await Promise.all([
      prisma.visit.findUnique({ where: { id: visitId }, select: { id:true, storeId:true } }),
      prisma.station.findUnique({ where: { id: stationId }, select: { id:true, storeId:true } }),
    ]);
    if(!visit)   return res.status(404).json({message:"Ziyaret bulunamadı"});
    if(!station) return res.status(404).json({message:"İstasyon bulunamadı"});

    // Ziyaret ile istasyon aynı mağazada mı? (tutarlılık)
    if (visit.storeId !== station.storeId) {
      return res.status(400).json({message:"Ziyaret ve istasyon farklı mağazalara ait"});
    }
    if (req.user.role === "employee") await ensureEmployeeStoreAccess(req, station.storeId);

    const base = {
      stationId: station.id,
      storeId: station.storeId,
      visitId: visit.id, // şeman varsa
      type: String(req.body?.type || ""),
      risk: String(req.body?.risk || ""),
      aktiviteVar: !!req.body?.aktiviteVar,
      observedAt: parseISO(req.body?.observedAt) || new Date(),
      notes: req.body?.notes ? String(req.body.notes).trim() : null,
    };
    if (!base.type || !base.risk) return res.status(400).json({message:"type ve risk zorunlu"});

    let extras = {};
    if (base.type === "FARE_YEMLEME") extras = extractRodentBaitExtras(req.body);

    const created = await prisma.stationActivation.create({ data: { ...base, ...extras } });
    res.json({ message: "Aktivasyon eklendi", activation: created });
  }catch(e){
    console.error("POST /activations/visits/:visitId/stations/:stationId", e);
    res.status(500).json({message:"Sunucu hatası"});
  }
});

/* ───────────────── UPDATE ─────────────────
   PUT /api/activations/:id
   admin/employee
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
    if ("aktiviteVar" in req.body) data.aktiviteVar = Number(req.body.aktiviteVar) || 0;
    if ("observedAt" in req.body) {
      const d = parseISO(req.body.observedAt);
      if (!d) return res.status(400).json({message:"observedAt geçersiz"});
      data.observedAt = d;
    }
    if ("notes" in req.body) data.notes = req.body.notes ? String(req.body.notes).trim() : null;

    // Alanlar (Sayısal)
    if ("deformeYem" in req.body)          data.deformeYem = Number(req.body.deformeYem) || 0;
    if ("yemDegisti" in req.body)          data.yemDegisti = Number(req.body.yemDegisti) || 0;
    if ("deformeMonitor" in req.body)      data.deformeMonitor = Number(req.body.deformeMonitor) || 0;
    if ("monitorDegisti" in req.body)      data.monitorDegisti = Number(req.body.monitorDegisti) || 0;
    if ("ulasilamayanMonitor" in req.body) data.ulasilamayanMonitor = Number(req.body.ulasilamayanMonitor) || 0;
    if ("yapiskanDegisti" in req.body)     data.yapiskanDegisti = Number(req.body.yapiskanDegisti) || 0;

    if ("sariBantDegisim" in req.body)     data.sariBantDegisim = Number(req.body.sariBantDegisim) || 0;
    if ("arizaliEFK" in req.body)          data.arizaliEFK = Number(req.body.arizaliEFK) || 0;
    if ("tamirdeEFK" in req.body)          data.tamirdeEFK = Number(req.body.tamirdeEFK) || 0;
    if ("uvLambaDegisim" in req.body)      data.uvLambaDegisim = Number(req.body.uvLambaDegisim) || 0;
    if ("uvLambaAriza" in req.body)        data.uvLambaAriza = Number(req.body.uvLambaAriza) || 0;
    if ("karasinek" in req.body)           data.karasinek = Number(req.body.karasinek) || 0;
    if ("sivrisinek" in req.body)          data.sivrisinek = Number(req.body.sivrisinek) || 0;
    if ("diger" in req.body)               data.diger = Number(req.body.diger) || 0;

    if ("feromonDegisti" in req.body)      data.feromonDegisti = Number(req.body.feromonDegisti) || 0;
    if ("deformeTuzak" in req.body)        data.deformeTuzak = Number(req.body.deformeTuzak) || 0;
    if ("tuzakDegisti" in req.body)        data.tuzakDegisti = Number(req.body.tuzakDegisti) || 0;
    if ("ulasilamayanTuzak" in req.body)   data.ulasilamayanTuzak = Number(req.body.ulasilamayanTuzak) || 0;
    if ("guve" in req.body)                data.guve = Number(req.body.guve) || 0;
    if ("hedefZararliSayisi" in req.body)  data.hedefZararliSayisi = Number(req.body.hedefZararliSayisi) || 0;

    const updated = await prisma.stationActivation.update({ where: { id }, data });
    res.json({ message: "Aktivasyon güncellendi", activation: updated });
  }catch(e){
    if (e.code === "P2025") return res.status(404).json({message:"Bulunamadı"});
    console.error("PUT /activations/:id", e);
    res.status(500).json({message:"Sunucu hatası"});
  }
});

/* ───────────────── DELETE ─────────────────
   DELETE /api/activations/:id
   admin/employee
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
