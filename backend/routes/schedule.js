import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { auth, roleCheck } from "../middleware/auth.js";

const prisma = new PrismaClient();
const router = Router();

/* helpers */
const parseId = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };
const parseISO = (v) => { try { const d = new Date(v); return isNaN(d.getTime()) ? null : d; } catch { return null; } };
const isQuarter = (date) => date.getMinutes() % 15 === 0;

/** Şemaya uygun status seti */
const ALLOWED_STATUSES = ["PENDING","PLANNED","COMPLETED","FAILED","CANCELLED","POSTPONED"];
const asStatus = (val) => {
  const s = String(val || "").toUpperCase();
  return ALLOWED_STATUSES.includes(s) ? s : null;
};

async function resolvePlannerName(prisma, role, id, u) {
  // 1) Token'dan gelenler
  if (u?.fullName || u?.name || u?.email || u?.username) {
    return u.fullName || u.name || u.email || u.username;
  }
  if (!role || !id) return null;

  // 2) Employee
  if (role === "employee") {
    const emp = await prisma.employee.findUnique({
      where: { id: Number(id) },
      select: { fullName: true, email: true },
    });
    return emp?.fullName || emp?.email || null;
  }

  // 3) Admin (yalnız mevcut alanlar)
  if (prisma.admin?.findUnique) {
    const a = await prisma.admin.findUnique({
      where: { id: Number(id) },
      select: { fullName: true, email: true },
    });
    if (a) return a.fullName || a.email || null;
  }

  // 4) (Varsa) User modeli
  if (prisma.user?.findUnique) {
    const urec = await prisma.user.findUnique({
      where: { id: Number(id) },
      select: { fullName: true, email: true },
    });
    if (urec) return urec.fullName || urec.email || null;
  }
  return null;
}

/* ---------- GET /api/schedule/events ---------- */
router.get(
  "/events",
  auth, roleCheck(["admin", "employee"]),
  async (req, res) => {
    try {
      const from = parseISO(req.query.from);
      const to   = parseISO(req.query.to);
      if (!from || !to) return res.status(400).json({ error: "from/to zorunludur (ISO tarih)" });
      if (to <= from)  return res.status(400).json({ error: "to, from'dan büyük olmalı" });

      const employeeId = req.query.employeeId ? parseId(req.query.employeeId) : null;
      const storeId    = req.query.storeId ? parseId(req.query.storeId) : null;

      const where = {
        AND: [
          { start: { lt: to } },
          { end:   { gt: from } },
          ...(employeeId ? [{ employeeId }] : []),
          ...(storeId ? [{ storeId }] : []),
        ],
      };

      const list = await prisma.scheduleEvent.findMany({
        where,
        orderBy: { start: "asc" },
      });

      // isim haritaları
      const empIds   = Array.from(new Set(list.map(x => x.employeeId)));
      const storeIds = Array.from(new Set(list.map(x => x.storeId)));

      let empMap = {};
      if (empIds.length) {
        const emps = await prisma.employee.findMany({
          where: { id: { in: empIds } },
          select: { id: true, fullName: true, email: true },
        });
        empMap = Object.fromEntries(
          emps.map(u => [u.id, u.fullName || u.email || `Personel #${u.id}`])
        );
      }

      let storeMap = {};
      if (storeIds.length) {
        const stores = await prisma.store.findMany({
          where: { id: { in: storeIds } },
          select: { id: true, name: true, code: true },
        });
        storeMap = Object.fromEntries(
          stores.map(s => [s.id, s.code ? `${s.code} – ${s.name}` : s.name])
        );
      }

      const out = list.map(ev => ({
        id: ev.id,
        title: ev.title,
        notes: ev.notes,
        start: ev.start,
        end: ev.end,
        employeeId: ev.employeeId,
        storeId: ev.storeId,
        employeeName: empMap[ev.employeeId] || null,
        storeName: storeMap[ev.storeId] || null,
        status: ev.status, // ← şemadaki enum
        plannedById: ev.plannedById ?? null,
        plannedByRole: ev.plannedByRole ?? null,
        plannedByName: ev.plannedByName ?? null,
        plannedAt: ev.plannedAt ?? null,
      }));

      res.json(out);
    } catch (e) {
      console.error("GET /schedule/events", e);
      res.status(500).json({ error: "Sunucu hatası" });
    }
  }
);

/* ---------- POST /api/schedule/events ---------- */
router.post(
  "/events",
  auth,
  roleCheck(["admin"]), // istersen ["admin","employee"] yap
  async (req, res) => {
    try {
      const title = String(req.body?.title || "").trim() || "Ziyaret";
      const notes = req.body?.notes ? String(req.body.notes) : null;
      const employeeId = Number(req.body?.employeeId) || null;
      const storeId    = Number(req.body?.storeId) || null;
      const start = req.body?.start ? new Date(req.body.start) : null;
      const end   = req.body?.end ? new Date(req.body.end) : null;
      const status = req.body?.status ? asStatus(req.body.status) : null; // opsiyonel

      if (!employeeId) return res.status(400).json({ error: "employeeId zorunludur" });
      if (!storeId)    return res.status(400).json({ error: "storeId zorunludur" });
      if (!start || !end || isNaN(start) || isNaN(end))
        return res.status(400).json({ error: "start/end zorunludur (ISO)" });
      if (end <= start) return res.status(400).json({ error: "end, start'tan büyük olmalı" });
      if (!isQuarter(start) || !isQuarter(end))
        return res.status(400).json({ error: "Saatler 15 dakikalık aralıklara oturmalı (örn. 09:00, 09:15…)" });

      // ÇAKIŞMA
      const conflict = await prisma.scheduleEvent.findFirst({
        where: { employeeId, AND: [{ start: { lt: end } }, { end: { gt: start } }] },
      });
      if (conflict) {
        return res.status(409).json({ error: "Personelin aynı zamanda başka bir ziyareti var." });
      }

      // Planlayan
      const u = req.user ?? {};
      const plannedById   = Number(u.id ?? u.userId) || null;
      const plannedByRole = u.role ?? null;
      const plannedByName = await resolvePlannerName(prisma, plannedByRole, plannedById, u);

      const created = await prisma.scheduleEvent.create({
        data: {
          title, notes, employeeId, storeId, start, end,
          plannedById, plannedByRole, plannedByName,
          ...(status ? { status } : {}), // verilirse kullan; yoksa DB default: PLANNED
        },
      });

      res.json({ message: "Ziyaret planlandı", event: created });
    } catch (e) {
      console.error("POST /schedule/events", e);
      res.status(500).json({ error: "Sunucu hatası" });
    }
  }
);

/* ---------- PUT /api/schedule/events/:id ---------- */
router.put(
  "/events/:id",
  auth, roleCheck(["admin","employee"]),
  async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Geçersiz id" });

      const current = await prisma.scheduleEvent.findUnique({ where: { id } });
      if (!current) return res.status(404).json({ error: "Bulunamadı" });

      const role = (req.user?.role || "").toLowerCase();

      /* ÇALIŞAN: sadece status güncelleyebilir */
      if (role === "employee") {
        if (!("status" in req.body)) {
          return res.status(403).json({ error: "Çalışan sadece durum (status) güncelleyebilir." });
        }
        const st = asStatus(req.body.status);
        if (!st) return res.status(400).json({ error: "Geçersiz status" });
        const updated = await prisma.scheduleEvent.update({ where: { id }, data: { status: st } });
        return res.json({ message: "Durum güncellendi", event: updated });
      }

      /* ADMIN: tüm alanlar */
      const data = {};
      if ("title" in req.body) data.title = String(req.body.title || "").trim() || "Ziyaret";
      if ("notes" in req.body) data.notes = req.body.notes ? String(req.body.notes) : null;
      if ("employeeId" in req.body) {
        const eid = parseId(req.body.employeeId);
        if (!eid) return res.status(400).json({ error: "employeeId geçersiz" });
        data.employeeId = eid;
      }
      if ("storeId" in req.body) {
        const sid = parseId(req.body.storeId);
        if (!sid) return res.status(400).json({ error: "storeId geçersiz" });
        data.storeId = sid;
      }
      if ("start" in req.body) {
        const s = parseISO(req.body.start);
        if (!s) return res.status(400).json({ error: "start geçersiz (ISO)" });
        if (!isQuarter(s)) return res.status(400).json({ error: "start 15 dk grid'e oturmalı" });
        data.start = s;
      }
      if ("end" in req.body) {
        const e = parseISO(req.body.end);
        if (!e) return res.status(400).json({ error: "end geçersiz (ISO)" });
        if (!isQuarter(e)) return res.status(400).json({ error: "end 15 dk grid'e oturmalı" });
        data.end = e;
      }
      if ("status" in req.body) {
        const st = asStatus(req.body.status);
        if (!st) return res.status(400).json({ error: "Geçersiz status" });
        data.status = st;
      }

      const s = data.start ?? current.start;
      const e = data.end   ?? current.end;
      if (e <= s) return res.status(400).json({ error: "end, start'tan büyük olmalı" });

      const eid = data.employeeId ?? current.employeeId;
      const conflict = await prisma.scheduleEvent.findFirst({
        where: {
          id: { not: id },
          employeeId: eid,
          AND: [{ start: { lt: e } }, { end: { gt: s } }],
        },
      });
      if (conflict) return res.status(409).json({ error: "Personelin aynı zaman aralığında başka ziyareti var." });

      const updated = await prisma.scheduleEvent.update({ where: { id }, data });
      res.json({ message: "Güncellendi", event: updated });
    } catch (e) {
      console.error("PUT /schedule/events/:id", e);
      res.status(500).json({ error: "Sunucu hatası" });
    }
  }
);

/* ---------- GET /api/schedule/events/:id ---------- */
router.get(
  "/events/:id",
  auth, roleCheck(["admin", "employee"]),
  async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Geçersiz id" });

      const ev = await prisma.scheduleEvent.findUnique({ where: { id } });
      if (!ev) return res.status(404).json({ error: "Bulunamadı" });

      // Personel adı
      let employeeName = null;
      if (ev.employeeId) {
        const emp = await prisma.employee.findUnique({
          where: { id: ev.employeeId },
          select: { id: true, fullName: true, email: true },
        });
        if (emp) employeeName = emp.fullName || emp.email || `Personel #${emp.id}`;
      }

      // Mağaza
      let storeName = null;
      let store = null;
      if (ev.storeId) {
        store = await prisma.store.findUnique({ where: { id: ev.storeId } });
        if (store) storeName = store.code ? `${store.code} – ${store.name}` : store.name;
      }

      // Planlayan: isim zaten event üzerinde
      const plannedByName =
        ev.plannedByName ??
        (ev.plannedByRole === "admin" && ev.plannedById ? `Admin #${ev.plannedById}` :
         ev.plannedByRole === "employee" && ev.plannedById ? `Personel #${ev.plannedById}` : null);

      res.json({
        id: ev.id,
        title: ev.title,
        notes: ev.notes,
        start: ev.start,
        end: ev.end,
        employeeId: ev.employeeId,
        storeId: ev.storeId,
        employeeName,
        storeName,
        store,

        status: ev.status, // ← enum
        plannedById: ev.plannedById,
        plannedByRole: ev.plannedByRole,
        plannedByName: ev.plannedByName,
        plannedAt: ev.plannedAt,
      });
    } catch (e) {
      console.error("GET /schedule/events/:id", e);
      res.status(500).json({ error: "Sunucu hatası" });
    }
  }
);

export default router;
