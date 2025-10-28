// routes/presence.js
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { auth } from "../middleware/auth.js";

const router = Router();
const prisma = new PrismaClient();

/* ---------------- helpers ---------------- */

// basit haversine (metre)
const HAVERSINE = (p1, p2) => {
  const toRad = (v)=> (v*Math.PI)/180;
  const R = 6371000;
  const dLat = toRad(Number(p2.lat)-Number(p1.lat));
  const dLon = toRad(Number(p2.lng)-Number(p1.lng));
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(Number(p1.lat)))*Math.cos(toRad(Number(p2.lat)))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(a));
};

const isValidationErr = (e) =>
  String(e?.name || "").includes("PrismaClientValidationError");

// rol bazlı direkt update dene
async function tryUpdateByRole(role, id, now) {
  if (role === "admin")    return prisma.admin.update({    where: { id }, data: { lastSeenAt: now } });
  if (role === "employee") return prisma.employee.update({ where: { id }, data: { lastSeenAt: now } });

  if (role === "customer") {
    // AccessOwner oturumu da FE için "customer" rolüyle gelir
    try {
      return await prisma.accessOwner.update({ where: { id }, data: { lastSeenAt: now } });
    } catch (e) {
      if (e?.code !== "P2025") throw e; // kayıt yoksa P2025, yoksa farklı hata
      // Gerçek Customer tablonuzda lastSeenAt yoksa bu çağrı ValidationError atar — sessiz geçiyoruz
      try { return await prisma.customer.update({ where: { id }, data: { lastSeenAt: now } }); }
      catch { return null; }
    }
  }

  throw new Error("unknown-role");
}

// fallback: id -> email ile bul ve yaz
async function fallbackUpdateAny({ id, email }, now) {
  // 1) id ile sırayla dene
  for (const fn of [
    () => prisma.admin.update({ where: { id }, data: { lastSeenAt: now } }),
    () => prisma.employee.update({ where: { id }, data: { lastSeenAt: now } }),
    () => prisma.accessOwner.update({ where: { id }, data: { lastSeenAt: now } }),
    () => prisma.customer.update({ where: { id }, data: { lastSeenAt: now } }),
  ]) {
    try { return await fn(); }
    catch (e) {
      if (e?.code === "P2025" || isValidationErr(e)) continue; // kayıt yok ya da kolon yok
      throw e;
    }
  }

  // 2) email ile dene
  if (email) {
    const ao = await prisma.accessOwner.findUnique({ where: { email } }).catch(()=>null);
    if (ao) return prisma.accessOwner.update({ where: { id: ao.id }, data: { lastSeenAt: now } });

    const ad = await prisma.admin.findUnique({ where: { email } }).catch(()=>null);
    if (ad) return prisma.admin.update({ where: { id: ad.id }, data: { lastSeenAt: now } });

    const emp = await prisma.employee.findUnique({ where: { email } }).catch(()=>null);
    if (emp) return prisma.employee.update({ where: { id: emp.id }, data: { lastSeenAt: now } });

    const cust = await prisma.customer.findUnique({ where: { email } }).catch(()=>null);
    if (cust) {
      try { return await prisma.customer.update({ where: { id: cust.id }, data: { lastSeenAt: now } }); }
      catch { /* kolon yoksa sessiz geç */ }
    }
  }
  return null;
}

/* ---------------- routes ---------------- */

/**
 * POST /api/presence/heartbeat
 * - lastSeenAt günceller (rol yanlış gelse bile fallback)
 * - employee için (lat,lng) geldiyse hafif geotrack kaydı
 */
router.post("/heartbeat", auth, async (req, res) => {
  try {
    const now = new Date();
    const { id, role, email } = req.user || {};

    // 1) lastSeenAt
    let updated = null;
    try {
      updated = await tryUpdateByRole(role, id, now);
    } catch (e) {
      if (e?.code === "P2025" || e?.message === "unknown-role") {
        updated = await fallbackUpdateAny({ id, email }, now);
      } else {
        throw e;
      }
    }

    // 2) opsiyonel: employee geotrack
    const { lat, lng, accuracy, speed, heading } = req.body || {};
    let wrotePoint = false;

    const isEmployee =
      (role === "employee") ||
      (!!updated && Object.prototype.hasOwnProperty.call(updated, "jobTitle"));

    if (isEmployee && typeof lat === "number" && typeof lng === "number") {
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
        const dt = (now.getTime() - new Date(last.at).getTime()) / 1000;
        // 50m/120s eşiği
        if (dist < 50 && dt < 120) shouldInsert = false;
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

    // 3) rastgele temizlik (7 gün)
    if (Math.random() < 0.02) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      await prisma.employeeTrackPoint.deleteMany({ where: { at: { lt: sevenDaysAgo } } });
    }

    return res.json({ ok: true, at: now.toISOString(), wrotePoint });
  } catch (err) {
    console.error("POST /presence/heartbeat error:", err);
    return res.status(500).json({ ok: false, message: "Sunucu hatası" });
  }
});

/**
 * GET /api/presence/summary
 * - Admin / Employee / AccessOwner (FE uyumu için customers alias’ı da verilir)
 */
router.get("/summary", auth, async (_req, res) => {
  try {
    const ONLINE_SEC = Number(process.env.PRESENCE_ONLINE_SEC ?? 120); // 2 dk
    const IDLE_SEC   = Number(process.env.PRESENCE_IDLE_SEC ?? 900);  // 15 dk

    const now = new Date();
    const onlineSince = new Date(now.getTime() - ONLINE_SEC * 1000);
    const idleSince   = new Date(now.getTime() - IDLE_SEC * 1000);

    const countBuckets = async (model) => {
      const total  = await model.count();
      const online = await model.count({ where: { lastSeenAt: { gte: onlineSince } } });
      const idle   = await model.count({ where: { lastSeenAt: { gte: idleSince, lt: onlineSince } } });
      const offline = Math.max(0, total - online - idle);
      return { total, online, idle, offline };
    };

    const [admins, employees, accessOwners] = await Promise.all([
      countBuckets(prisma.admin),
      countBuckets(prisma.employee),
      countBuckets(prisma.accessOwner), // müşteriler için AccessOwner’ı kullanıyoruz
    ]);

    // FE geriye uyumluluk: customers = accessOwners
    return res.json({
      ok: true,
      updatedAt: now.toISOString(),
      admins,
      employees,
      customers: accessOwners,
      accessOwners,
    });
  } catch (err) {
    console.error("GET /presence/summary error:", err);
    return res.status(500).json({ ok: false, message: "Sunucu hatası" });
  }
});

export default router;
