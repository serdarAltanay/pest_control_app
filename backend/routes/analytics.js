// src/routes/analytics.js
import { Router } from "express";
import { PrismaClient, Prisma } from "@prisma/client";
import { auth, roleCheck } from "../middleware/auth.js";

const prisma = new PrismaClient();
const router = Router();

const parseId = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };
const parseISO = (v) => { if (!v) return null; const d = new Date(v); return Number.isFinite(+d) ? d : null; };

// MySQL bucket expr
function bucketExpr(bucket){
  switch (bucket) {
    case "day":   return Prisma.sql`DATE(observedAt)`;
    case "week":  return Prisma.sql`STR_TO_DATE(CONCAT(YEARWEEK(observedAt, 3), ' Monday'), '%X%V %W')`;
    case "month": return Prisma.sql`DATE_FORMAT(observedAt, '%Y-%m-01')`;
    default:      return Prisma.sql`DATE(observedAt)`;
  }
}

/** TREND: /api/analytics/stores/:storeId/trend?from&to&bucket=day|week|month&type=&risk= */
router.get(
  "/stores/:storeId/trend",
  auth, roleCheck(["admin","employee"]),
  async (req,res)=>{
    try{
      const storeId = parseId(req.params.storeId);
      if(!storeId) return res.status(400).json({message:"Geçersiz storeId"});

      const from = parseISO(req.query.from) || new Date(Date.now()-1000*60*60*24*30);
      const to   = parseISO(req.query.to)   || new Date();
      const bucket = ["day","week","month"].includes(String(req.query.bucket)) ? String(req.query.bucket) : "day";
      const type = req.query.type ? String(req.query.type) : null;
      const risk = req.query.risk ? String(req.query.risk) : null;

      const bexpr = bucketExpr(bucket);
      const where = Prisma.sql`
        storeId = ${storeId}
        AND observedAt >= ${from} AND observedAt <= ${to}
        ${type ? Prisma.sql` AND type = ${type}` : Prisma.empty}
        ${risk ? Prisma.sql` AND risk = ${risk}` : Prisma.empty}
      `;

      const rows = await prisma.$queryRaw`
        SELECT 
          ${bexpr} AS bucket,
          COUNT(*) AS count,
          SUM(CASE WHEN aktiviteVar = true THEN 1 ELSE 0 END) AS activityCount
        FROM StationActivation
        WHERE ${where}
        GROUP BY bucket
        ORDER BY bucket ASC
      `;

      res.json(rows.map(r=>({
        bucket: typeof r.bucket === "string" ? r.bucket : new Date(r.bucket).toISOString().slice(0,10),
        count: Number(r.count||0),
        activityCount: Number(r.activityCount||0),
      })));
    }catch(e){
      console.error("GET /analytics/stores/:storeId/trend", e);
      res.status(500).json({message:"Sunucu hatası"});
    }
  }
);

/** SUMMARY: /api/analytics/stores/:storeId/summary?from&to&type= */
router.get(
  "/stores/:storeId/summary",
  auth, roleCheck(["admin","employee"]),
  async (req,res)=>{
    try{
      const storeId = parseId(req.params.storeId);
      if(!storeId) return res.status(400).json({message:"Geçersiz storeId"});

      const from = parseISO(req.query.from) || new Date(Date.now()-1000*60*60*24*30);
      const to   = parseISO(req.query.to)   || new Date();
      const type = req.query.type ? String(req.query.type) : null;

      const where = Prisma.sql`
        storeId = ${storeId}
        AND observedAt >= ${from} AND observedAt <= ${to}
        ${type ? Prisma.sql` AND type = ${type}` : Prisma.empty}
      `;

      const byType = await prisma.$queryRaw`
        SELECT type, COUNT(*) as cnt
        FROM StationActivation WHERE ${where}
        GROUP BY type
      `;
      const byRisk = await prisma.$queryRaw`
        SELECT risk, COUNT(*) as cnt
        FROM StationActivation WHERE ${where}
        GROUP BY risk
      `;
      const totals = await prisma.$queryRaw`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN aktiviteVar = true THEN 1 ELSE 0 END) as activeCnt
        FROM StationActivation WHERE ${where}
      `;

      const total = Number(totals?.[0]?.total || 0);
      const activeCnt = Number(totals?.[0]?.activeCnt || 0);

      res.json({
        byType: Object.fromEntries(byType.map(r => [r.type, Number(r.cnt)])),
        byRisk: Object.fromEntries(byRisk.map(r => [r.risk, Number(r.cnt)])),
        activityRate: total ? (activeCnt/total) : 0,
        range: { from, to }
      });
    }catch(e){
      console.error("GET /analytics/stores/:storeId/summary", e);
      res.status(500).json({message:"Sunucu hatası"});
    }
  }
);

/** STATION TREND: /api/analytics/stations/:stationId/trend?from&to&bucket= */
router.get(
  "/stations/:stationId/trend",
  auth, roleCheck(["admin","employee"]),
  async (req,res)=>{
    try{
      const stationId = parseId(req.params.stationId);
      if(!stationId) return res.status(400).json({message:"Geçersiz stationId"});

      const from = parseISO(req.query.from) || new Date(Date.now()-1000*60*60*24*30);
      const to   = parseISO(req.query.to)   || new Date();
      const bucket = ["day","week","month"].includes(String(req.query.bucket)) ? String(req.query.bucket) : "day";

      const bexpr = bucketExpr(bucket);
      const rows = await prisma.$queryRaw`
        SELECT 
          ${bexpr} AS bucket,
          COUNT(*) AS count,
          SUM(CASE WHEN aktiviteVar = true THEN 1 ELSE 0 END) AS activityCount
        FROM StationActivation
        WHERE stationId = ${stationId}
          AND observedAt >= ${from} AND observedAt <= ${to}
        GROUP BY bucket
        ORDER BY bucket ASC
      `;

      res.json(rows.map(r=>({
        bucket: typeof r.bucket === "string" ? r.bucket : new Date(r.bucket).toISOString().slice(0,10),
        count: Number(r.count||0),
        activityCount: Number(r.activityCount||0),
      })));
    }catch(e){
      console.error("GET /analytics/stations/:stationId/trend", e);
      res.status(500).json({message:"Sunucu hatası"});
    }
  }
);

export default router;
