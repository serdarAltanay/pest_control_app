// routes/presence.js
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { auth } from "../middleware/auth.js";

const router = Router();
const prisma = new PrismaClient();

// Basit renk türetici (front ile aynı olsun diye id tabanlı hash)
function colorFromId(id) {
  const COLORS = ["#60a5fa","#34d399","#fbbf24","#f87171","#a78bfa","#22d3ee","#f472b6","#f97316","#84cc16","#e879f9","#38bdf8"];
  let h = 0; const s = String(id ?? "x");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}
const HAVERSINE = (p1, p2) => {
  const toRad = (v)=> (v*Math.PI)/180;
  const R = 6371000;
  const dLat = toRad(Number(p2.lat)-Number(p1.lat));
  const dLon = toRad(Number(p2.lng)-Number(p1.lng));
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(Number(p1.lat)))*Math.cos(toRad(Number(p2.lat)))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(a));
};

// POST /presence/heartbeat
// - Tüm roller lastSeenAt günceller.
// - Role=employee ve {lat,lng} varsa, son noktaya göre eşik kontrolüyle track kaydı atar.
// - Rastgele (%2) temizlik: 7 günden eski kayıtları siler (şişme önleme).
router.post("/heartbeat", auth, async (req, res) => {
  try {
    const { id, role } = req.user;
    const now = new Date();

    // 1) lastSeenAt güncelle
    if (role === "admin") {
      await prisma.admin.update({ where: { id }, data: { lastSeenAt: now } });
    } else if (role === "employee") {
      await prisma.employee.update({ where: { id }, data: { lastSeenAt: now } });
    } else if (role === "customer") {
      await prisma.customer.update({ where: { id }, data: { lastSeenAt: now } });
    }

    // 2) Sadece employee için isteğe bağlı konum kaydı
    const { lat, lng, accuracy, speed, heading } = req.body || {};
    let wrotePoint = false;

    if (role === "employee" && typeof lat === "number" && typeof lng === "number") {
      // Son nokta -> hareket / zaman eşiği
      const last = await prisma.employeeTrackPoint.findFirst({
        where: { employeeId: id },
        orderBy: { at: "desc" },
        select: { lat: true, lng: true, at: true },
      });

      let shouldInsert = true;
      if (last) {
        const dist = HAVERSINE(
          { lat: Number(last.lat), lng: Number(last.lng) },
          { lat, lng }
        );
        const dt = (now.getTime() - new Date(last.at).getTime()) / 1000; // sn
        // hareket çok azsa ve aralık kısa ise kayıt atlama:
        if (dist < 50 && dt < 120) shouldInsert = false; // <50 m VE <2 dk ise yazma
      }

      if (shouldInsert) {
        await prisma.employeeTrackPoint.create({
          data: {
            employeeId: id,
            lat, lng,
            accuracy: typeof accuracy === "number" ? Math.round(accuracy) : null,
            speed: typeof speed === "number" ? speed : null,
            heading: typeof heading === "number" ? heading : null,
            source: "heartbeat",
            at: now,
          }
        });
        wrotePoint = true;
      }
    }

    // 3) %2 olasılıkla 7 günden eski kayıtları sil (global temizlik)
    if (Math.random() < 0.02) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      await prisma.employeeTrackPoint.deleteMany({
        where: { at: { lt: sevenDaysAgo } }
      });
    }

    return res.json({ ok: true, at: now.toISOString(), wrotePoint });
  } catch (err) {
    console.error("POST /presence/heartbeat error:", err);
    return res.status(500).json({ ok: false, message: "Sunucu hatası" });
  }
});

router.get("/summary", auth, async (req, res) => {
  try {
    const ONLINE_SEC = Number(process.env.PRESENCE_ONLINE_SEC ?? 120); // 2 dk
    const IDLE_SEC   = Number(process.env.PRESENCE_IDLE_SEC ?? 900);  // 15 dk

    const now = new Date();
    const onlineSince = new Date(now.getTime() - ONLINE_SEC * 1000);
    const idleSince   = new Date(now.getTime() - IDLE_SEC * 1000);

    // helper: tek model için bucket hesapları (count ile)
    const countBuckets = async (model) => {
      const total  = await model.count();
      const online = await model.count({ where: { lastSeenAt: { gte: onlineSince } } });
      const idle   = await model.count({ where: { lastSeenAt: { gte: idleSince, lt: onlineSince } } });
      const offline = Math.max(0, total - online - idle);
      return { total, online, idle, offline };
    };

    // üç rol için paralel çalıştır
    const [admins, employees, customers] = await Promise.all([
      countBuckets(prisma.admin),
      countBuckets(prisma.employee),
      countBuckets(prisma.customer),
    ]);

    return res.json({
      ok: true,
      updatedAt: now.toISOString(),
      admins,
      employees,
      customers,
    });
  } catch (err) {
    console.error("GET /presence/summary error:", err);
    return res.status(500).json({ ok: false, message: "Sunucu hatası" });
  }
});

// GET /presence/tracks?day=YYYY-MM-DD
router.get("/tracks", auth, async (req, res) => {
  try {
    const dayStr = (req.query.day || "").trim();
    const day = dayStr ? new Date(`${dayStr}T00:00:00.000Z`) : new Date();
    const from = new Date(day); from.setUTCHours(0,0,0,0);
    const to   = new Date(day); to.setUTCHours(23,59,59,999);

    const whereEmployee =
      req.user.role === "admin" ? {} : { employeeId: req.user.id };

    const points = await prisma.employeeTrackPoint.findMany({
      where: { ...whereEmployee, at: { gte: from, lte: to } },
      orderBy: [{ employeeId: "asc" }, { at: "asc" }],
      select: { employeeId: true, lat: true, lng: true, accuracy: true, at: true }
    });

    const empIds = [...new Set(points.map(p => p.employeeId))];
    if (empIds.length === 0) {
      return res.json({ ok: true, day: from.toISOString().slice(0,10), data: {} });
    }

    let emps = [];
    try {
      emps = await prisma.employee.findMany({
        where: { id: { in: empIds } },
        select: { id: true, fullName: true, email: true },
      });
    } catch {
      const raw = await prisma.employee.findMany({
        where: { id: { in: empIds } },
        select: { id: true, name: true, email: true },
      });
      emps = raw.map(e => ({ id: e.id, fullName: e.name, email: e.email }));
    }

    const empMap = new Map(emps.map(e => [e.id, e]));
    const grouped = {};
    for (const p of points) {
      const meta = empMap.get(p.employeeId);
      const displayName = meta?.fullName || meta?.name || meta?.email || `Personel #${p.employeeId}`;
      (grouped[p.employeeId] ||= {
        employee: { id: p.employeeId, name: displayName, color: colorFromId(p.employeeId) },
        points: [],
      });
      grouped[p.employeeId].points.push({
        lat: Number(p.lat),
        lng: Number(p.lng),
        accuracy: p.accuracy ?? null,
        at: p.at,
      });
    }

    return res.json({ ok: true, day: from.toISOString().slice(0,10), data: grouped });
  } catch (err) {
    console.error("GET /presence/tracks error:", err?.message || err);
    return res.status(500).json({ ok: false, message: "Sunucu hatası" });
  }
});



export default router;
