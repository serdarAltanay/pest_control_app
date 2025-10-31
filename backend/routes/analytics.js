// src/routes/analytics.js
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { auth, roleCheck } from "../middleware/auth.js";

const prisma = new PrismaClient();
const router = Router();

/** ---- helpers ---- */
const parseId = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };
const parseISO = (v) => { if (!v) return null; const d = new Date(v); return Number.isFinite(+d) ? d : null; };

function ymd(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function ym(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; }
function isoWeekKey(d){
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7; // 1..7 (Mon..Sun)
  date.setUTCDate(date.getUTCDate() + (4 - dayNum));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2,"0")}`;
}
function bucketKey(d, bucket){
  if (bucket === "month") return ym(d);
  if (bucket === "week") return isoWeekKey(d);
  return ymd(d);
}

// Employee → tüm mağazalarda serbest
async function ensureEmployeeStoreAccess(req, storeId) {
  return true;
}

// Customer (AccessOwner) grant kontrolü
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

/** ---------------- STORE-BAZLI TREND ----------------
 * GET /api/analytics/stores/:storeId/trend?from&to&bucket=day|week|month&type=&risk=
 * admin/employee/customer → read-only
 */
router.get("/stores/:storeId/trend", auth, roleCheck(["admin","employee","customer"]), async (req,res)=>{
  try{
    const storeId = parseId(req.params.storeId);
    if(!storeId) return res.status(400).json({message:"Geçersiz storeId"});

    if (req.user.role === "customer") {
      const ok = await customerHasStoreAccess(req, storeId);
      if (!ok) return res.status(403).json({ message: "Yetkisiz" });
    }
    // employee/admin → serbest

    const now = new Date();
    const to = parseISO(req.query.to) || now;
    const from = parseISO(req.query.from) || new Date(now.getFullYear(), now.getMonth()-5, 1);
    const bucket = ["day","week","month"].includes(String(req.query.bucket)) ? String(req.query.bucket) : "day";
    const type = req.query.type ? String(req.query.type) : undefined;
    const risk = req.query.risk ? String(req.query.risk) : undefined;

    const items = await prisma.stationActivation.findMany({
      where: {
        storeId,
        observedAt: { gte: from, lte: to },
        ...(type ? { type } : {}),
        ...(risk ? { risk } : {}),
      },
      select: { observedAt:true, aktiviteVar:true },
      orderBy: { observedAt: "asc" },
    });

    const map = {};
    for (const it of items) {
      const d = new Date(it.observedAt);
      const key = bucketKey(d, bucket);
      if (!map[key]) map[key] = { bucket: key, count: 0, activityCount: 0 };
      map[key].count += 1;
      if (it.aktiviteVar) map[key].activityCount += 1;
    }
    const out = Object.values(map).sort((a,b)=>a.bucket.localeCompare(b.bucket));
    res.json(out);
  }catch(e){
    console.error("GET /analytics/stores/:storeId/trend", e);
    res.status(500).json({message:"Sunucu hatası"});
  }
});

/** ---------------- STORE-BAZLI ÖZET ----------------
 * GET /api/analytics/stores/:storeId/summary?from&to&type=
 * admin/employee/customer → read-only
 */
router.get("/stores/:storeId/summary", auth, roleCheck(["admin","employee","customer"]), async (req,res)=>{
  try{
    const storeId = parseId(req.params.storeId);
    if(!storeId) return res.status(400).json({message:"Geçersiz storeId"});

    if (req.user.role === "customer") {
      const ok = await customerHasStoreAccess(req, storeId);
      if (!ok) return res.status(403).json({ message: "Yetkisiz" });
    }
    // employee/admin → serbest

    const now = new Date();
    const to = parseISO(req.query.to) || now;
    const from = parseISO(req.query.from) || new Date(now.getFullYear(), now.getMonth()-1, now.getDate());
    const type = req.query.type ? String(req.query.type) : undefined;

    const items = await prisma.stationActivation.findMany({
      where: {
        storeId,
        observedAt: { gte: from, lte: to },
        ...(type ? { type } : {}),
      },
      select: { type:true, risk:true, aktiviteVar:true },
    });

    const byType = {};
    const byRisk = {};
    let total = 0, activeCnt = 0;
    for (const it of items) {
      byType[it.type] = (byType[it.type] || 0) + 1;
      byRisk[it.risk] = (byRisk[it.risk] || 0) + 1;
      total += 1;
      if (it.aktiviteVar) activeCnt += 1;
    }

    res.json({ byType, byRisk, activityRate: total ? activeCnt/total : 0, range: { from, to } });
  }catch(e){
    console.error("GET /analytics/stores/:storeId/summary", e);
    res.status(500).json({message:"Sunucu hatası"});
  }
});

/** ---------------- STATION-BAZLI TREND ----------------
 * GET /api/analytics/stations/:stationId/trend?from&to&bucket=
 * admin/employee/customer → read-only
 */
router.get("/stations/:stationId/trend", auth, roleCheck(["admin","employee","customer"]), async (req,res)=>{
  try{
    const stationId = parseId(req.params.stationId);
    if(!stationId) return res.status(400).json({message:"Geçersiz stationId"});

    const st = await prisma.station.findUnique({ where:{ id: stationId }, select:{ storeId:true }});
    if(!st) return res.status(404).json({message:"İstasyon yok"});

    if (req.user.role === "customer") {
      const ok = await customerHasStoreAccess(req, st.storeId);
      if (!ok) return res.status(403).json({ message: "Yetkisiz" });
    }
    // employee/admin → serbest

    const now = new Date();
    const to = parseISO(req.query.to) || now;
    const from = parseISO(req.query.from) || new Date(now.getFullYear(), now.getMonth()-5, 1);
    const bucket = ["day","week","month"].includes(String(req.query.bucket)) ? String(req.query.bucket) : "month";

    const items = await prisma.stationActivation.findMany({
      where: { stationId, observedAt: { gte: from, lte: to } },
      select: { observedAt:true, aktiviteVar:true },
      orderBy: { observedAt: "asc" },
    });

    const map = {};
    for(const it of items){
      const d = new Date(it.observedAt);
      const key = bucketKey(d, bucket);
      if(!map[key]) map[key] = { bucket:key, count:0, activityCount:0 };
      map[key].count += 1;
      if(it.aktiviteVar) map[key].activityCount += 1;
    }
    const out = Object.values(map).sort((a,b)=>a.bucket.localeCompare(b.bucket));
    res.json(out);
  }catch(e){
    console.error("GET /analytics/stations/:stationId/trend", e);
    res.status(500).json({message:"Sunucu hatası"});
  }
});

export default router;
