// routes/schedule.js
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { auth, roleCheck } from "../middleware/auth.js";
import { sendVisitPlannedToEmployee } from "../lib/mailer.js";

const prisma = new PrismaClient();
const router = Router();

/* ========== helpers ========== */
const parseId  = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };
const parseISO = (v) => { try { const d = new Date(v); return isNaN(d.getTime()) ? null : d; } catch { return null; } };
const isQuarter = (date) => date.getMinutes() % 15 === 0;

const ALLOWED_STATUSES = ["PENDING","PLANNED","COMPLETED","FAILED","CANCELLED","POSTPONED"];
const asStatus = (val) => {
  const s = String(val || "").toUpperCase();
  return ALLOWED_STATUSES.includes(s) ? s : null;
};

/* ========== erişim: müşterinin görebileceği mağazalar ========== */
/* AccessOwner → AccessGrant ana yol + backward-compat (customerMembership/customerUser/token) */
async function getAccessibleStoreIdsForCustomer(prisma, user) {
  const storeIds = new Set();

  // NEW PATH: AccessOwner → AccessGrant
  let ownerId = Number(
    user?.accessOwnerId ??
    user?.ownerId ??
    ((user?.role || "").toLowerCase() === "customer" ? user?.id : null)
  );

  if ((!Number.isFinite(ownerId) || ownerId <= 0) && prisma.accessOwner?.findUnique) {
    const email = (user?.email || "").trim().toLowerCase();
    if (email) {
      const owner = await prisma.accessOwner.findUnique({ where: { email }, select: { id: true } });
      if (owner?.id) ownerId = owner.id;
    }
  }

  if (Number.isFinite(ownerId) && ownerId > 0 && prisma.accessGrant?.findMany) {
    const grants = await prisma.accessGrant.findMany({
      where: { ownerId },
      select: { scopeType: true, customerId: true, storeId: true },
    });
    if (grants.length) {
      const customerIds = [];
      for (const g of grants) {
        if (g.scopeType === "STORE" && g.storeId) storeIds.add(g.storeId);
        if (g.scopeType === "CUSTOMER" && g.customerId) customerIds.push(g.customerId);
      }
      if (customerIds.length) {
        const stores = await prisma.store.findMany({
          where: { customerId: { in: customerIds } },
          select: { id: true },
        });
        stores.forEach(s => storeIds.add(s.id));
      }
    }
  }

  // BACK-COMPAT: customerMembership
  const uid = Number(user?.id ?? user?.userId);
  if (prisma.customerMembership?.findMany && Number.isFinite(uid)) {
    const mems = await prisma.customerMembership.findMany({
      where: { userId: uid, isEnabled: true },
      select: { storeId: true, customerId: true },
    });
    const orgCustomerIds = mems.filter(m => !m.storeId && m.customerId).map(m => m.customerId);
    const explicitStoreIds = mems.filter(m => m.storeId).map(m => m.storeId);
    explicitStoreIds.forEach(id => storeIds.add(id));
    if (orgCustomerIds.length) {
      const stores = await prisma.store.findMany({ where: { customerId: { in: orgCustomerIds } }, select: { id: true } });
      stores.forEach(s => storeIds.add(s.id));
    }
  }

  // BACK-COMPAT: customerUser
  if (prisma.customerUser?.findUnique && Number.isFinite(uid)) {
    const cu = await prisma.customerUser.findUnique({
      where: { id: uid },
      select: { customerId: true, storeId: true },
    });
    if (cu?.storeId) storeIds.add(cu.storeId);
    if (cu?.customerId) {
      const stores = await prisma.store.findMany({ where: { customerId: cu.customerId }, select: { id: true } });
      stores.forEach(s => storeIds.add(s.id));
    }
  }

  // BACK-COMPAT: token payload
  if (Array.isArray(user?.storeIds)) {
    user.storeIds.forEach((x) => Number.isFinite(Number(x)) && storeIds.add(Number(x)));
  }
  if (user?.customerId && !storeIds.size) {
    const stores = await prisma.store.findMany({
      where: { customerId: Number(user.customerId) },
      select: { id: true },
    });
    stores.forEach(s => storeIds.add(s.id));
  }

  return Array.from(storeIds);
}

/* Planlayan adı (admin/employee kayıtlarından) */
async function resolvePlannerName(prisma, role, id, u) {
  if (u?.fullName || u?.name || u?.email || u?.username) {
    return u.fullName || u.name || u.email || u.username;
  }
  if (!role || !id) return null;

  if (role === "employee" && prisma.employee?.findUnique) {
    const emp = await prisma.employee.findUnique({
      where: { id: Number(id) },
      select: { fullName: true, email: true },
    });
    return emp?.fullName || emp?.email || null;
  }
  if (role === "admin" && prisma.admin?.findUnique) {
    const a = await prisma.admin.findUnique({
      where: { id: Number(id) },
      select: { fullName: true, email: true },
    });
    return a?.fullName || a?.email || null;
  }
  if (prisma.user?.findUnique) {
    const urec = await prisma.user.findUnique({
      where: { id: Number(id) },
      select: { fullName: true, email: true },
    });
    return urec?.fullName || urec?.email || null;
  }
  return null;
}

/* =========================================
   GET /api/schedule/events
   - admin/employee/customer
   - tarih aralığı çakışanları döner
   - employeeId/storeId/ scope=mine destekli
========================================= */
router.get(
  "/events",
  auth, roleCheck(["admin", "employee", "customer"]),
  async (req, res) => {
    try {
      const from = parseISO(req.query.from);
      const to   = parseISO(req.query.to);
      if (!from || !to) return res.status(400).json({ error: "from/to zorunludur (ISO tarih)" });
      if (to <= from)  return res.status(400).json({ error: "to, from'dan büyük olmalı" });

      const employeeIdQ = req.query.employeeId ? parseId(req.query.employeeId) : null;
      const storeIdQ    = req.query.storeId ? parseId(req.query.storeId) : null;
      const scope       = String(req.query.scope || "").toLowerCase(); // "mine" (employee)

      const role = (req.user?.role || "").toLowerCase();

      const whereAND = [{ start: { lt: to } }, { end: { gt: from } }];

      // MÜŞTERİ → erişebildiği mağazalar
      if (role === "customer") {
        const allowedStoreIds = await getAccessibleStoreIdsForCustomer(prisma, req.user);
        if (!allowedStoreIds.length) return res.json([]);
        if (storeIdQ && !allowedStoreIds.includes(storeIdQ)) return res.json([]);
        whereAND.push({ storeId: { in: allowedStoreIds } });
      }

      // ÇALIŞAN → scope=mine ise kendi görevleri
      if (role === "employee" && scope === "mine") {
        const eid = Number(req.user?.id ?? req.user?.userId);
        if (Number.isFinite(eid)) whereAND.push({ employeeId: eid });
      }

      // Serbest filtreler
      if (employeeIdQ) whereAND.push({ employeeId: employeeIdQ });
      if (storeIdQ)    whereAND.push({ storeId: storeIdQ });

      const where = { AND: whereAND };

      const list = await prisma.scheduleEvent.findMany({
        where,
        orderBy: { start: "asc" },
      });

      // ad/etiket haritaları
      const empIds   = Array.from(new Set(list.map(x => x.employeeId).filter(Boolean)));
      const storeIds = Array.from(new Set(list.map(x => x.storeId).filter(Boolean)));

      let empMap = {};
      if (empIds.length) {
        const emps = await prisma.employee.findMany({
          where: { id: { in: empIds } },
          select: { id: true, fullName: true, email: true },
        });
        empMap = Object.fromEntries(emps.map(u => [u.id, u.fullName || u.email || `Personel #${u.id}`]));
      }

      let storeMap = {};
      if (storeIds.length) {
        const stores = await prisma.store.findMany({
          where: { id: { in: storeIds } },
          select: { id: true, name: true, code: true },
        });
        storeMap = Object.fromEntries(stores.map(s => [s.id, s.code ? `${s.code} – ${s.name}` : s.name]));
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
        status: ev.status,
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

/* =========================================
   POST /api/schedule/events
   - admin (istersen employee de ekleyebilirsin)
   - 15 dk gridi, çakışma kontrolü
   - planlayan bilgisini set eder
   - bildirim + atanana e-posta gönderir
========================================= */
router.post(
  "/events",
  auth, roleCheck(["admin"]),
  async (req, res) => {
    try {
      const title      = String(req.body?.title || "").trim() || "Ziyaret";
      const notes      = req.body?.notes ? String(req.body.notes) : null;
      const employeeId = Number(req.body?.employeeId) || null;
      const storeId    = Number(req.body?.storeId) || null;
      const start      = req.body?.start ? new Date(req.body.start) : null;
      const end        = req.body?.end ? new Date(req.body.end) : null;
      const status     = req.body?.status ? asStatus(req.body.status) : null;

      if (!employeeId) return res.status(400).json({ error: "employeeId zorunludur" });
      if (!storeId)    return res.status(400).json({ error: "storeId zorunludur" });
      if (!start || !end || isNaN(start) || isNaN(end))
        return res.status(400).json({ error: "start/end zorunludur (ISO)" });
      if (end <= start) return res.status(400).json({ error: "end, start'tan büyük olmalı" });
      if (!isQuarter(start) || !isQuarter(end))
        return res.status(400).json({ error: "Saatler 15 dakikalık aralıklara oturmalı (örn. 09:00, 09:15…)" });

      // personel çakışma kontrolü
      const conflict = await prisma.scheduleEvent.findFirst({
        where: { employeeId, AND: [{ start: { lt: end } }, { end: { gt: start } }] },
      });
      if (conflict) return res.status(409).json({ error: "Personelin aynı zamanda başka bir ziyareti var." });

      // planlayan bilgisi
      const u = req.user ?? {};
      const plannedById   = Number(u.id ?? u.userId) || null;
      const plannedByRole = u.role ?? null;
      const plannedByName = await resolvePlannerName(prisma, plannedByRole, plannedById, u);

      const created = await prisma.scheduleEvent.create({
        data: {
          title, notes, employeeId, storeId, start, end,
          plannedById, plannedByRole, plannedByName,
          plannedAt: new Date(),
          ...(status ? { status } : {}),
        },
      });

      // --- Bildirim & E-posta (best-effort) ---
      (async () => {
        try {
          const store = await prisma.store.findUnique({
            where: { id: storeId },
            select: { name: true, code: true, city: true }
          });
          const emp = await prisma.employee.findUnique({
            where: { id: employeeId },
            select: { id: true, email: true, fullName: true, name: true }
          });

          const storeName = store?.name || `Mağaza #${storeId}`;
          const whenStr = `${new Date(start).toLocaleString("tr-TR")} – ${new Date(end).toLocaleString("tr-TR")}`;
          const detailPath = `/calendar/visit/${created.id}`;

          // 1) Tüm çalışanlara genel bildirim
          await prisma.notification.create({
            data: {
              type: "VISIT_PLANNED",
              title: "Yeni Ziyaret Planlandı",
              body: `${title} · ${storeName} · ${whenStr}`,
              link: detailPath,
              recipientRole: "EMPLOYEE",
            },
          }).catch(() => {});

          // 2) Atanan çalışana özel bildirim
          if (emp?.id) {
            await prisma.notification.create({
              data: {
                type: "VISIT_ASSIGNED",
                title: "Ziyaret Size Atandı",
                body: `${title} · ${storeName} · ${whenStr}`,
                link: detailPath,
                recipientRole: "EMPLOYEE",
                recipientId: emp.id,
              },
            }).catch(() => {});
          }

          // 3) Atanan çalışana e-posta
          if (emp?.email) {
            const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/,"");
            await sendVisitPlannedToEmployee({
              to: emp.email,
              data: {
                title,
                employeeName: emp.fullName || emp.name || "",
                storeName: store?.name || "",
                storeCode: store?.code || "",
                city: store?.city || "",
                start,
                end,
                detailUrl: `${appUrl}${detailPath}`,
              },
            }).catch(() => {});
          }
        } catch (err) {
          console.warn("VISIT notify/email error:", err?.message);
        }
      })();

      res.json({ message: "Ziyaret planlandı", event: created });
    } catch (e) {
      console.error("POST /schedule/events", e);
      res.status(500).json({ error: "Sunucu hatası" });
    }
  }
);

/* =========================================
   PUT /api/schedule/events/:id
   - employee: SADECE status günceller
   - admin: tüm alanları güncelleyebilir (grid/çakışma kuralları korunur)
========================================= */
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

      // ÇALIŞAN: sadece status
      if (role === "employee") {
        if (!("status" in req.body)) {
          return res.status(403).json({ error: "Çalışan sadece durum (status) güncelleyebilir." });
        }
        const st = asStatus(req.body.status);
        if (!st) return res.status(400).json({ error: "Geçersiz status" });
        const updated = await prisma.scheduleEvent.update({ where: { id }, data: { status: st } });
        return res.json({ message: "Durum güncellendi", event: updated });
      }

      // ADMIN: serbest güncelleme (validasyonlu)
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

/* =========================================
   GET /api/schedule/events/:id
   - admin/employee/customer (müşteri: mağaza erişim kontrolü)
========================================= */
router.get(
  "/events/:id",
  auth, roleCheck(["admin", "employee", "customer"]),
  async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Geçersiz id" });

      const ev = await prisma.scheduleEvent.findUnique({ where: { id } });
      if (!ev) return res.status(404).json({ error: "Bulunamadı" });

      const role = (req.user?.role || "").toLowerCase();
      if (role === "customer") {
        const allowed = await getAccessibleStoreIdsForCustomer(prisma, req.user);
        if (!allowed.includes(ev.storeId)) return res.status(403).json({ error: "Yetkiniz yok" });
      }

      let employeeName = null;
      if (ev.employeeId) {
        const emp = await prisma.employee.findUnique({
          where: { id: ev.employeeId },
          select: { id: true, fullName: true, email: true },
        });
        if (emp) employeeName = emp.fullName || emp.email || `Personel #${emp.id}`;
      }

      let storeName = null;
      let store = null;
      if (ev.storeId) {
        store = await prisma.store.findUnique({ where: { id: ev.storeId } });
        if (store) storeName = store.code ? `${store.code} – ${store.name}` : store.name;
      }

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
        status: ev.status,
        plannedById: ev.plannedById,
        plannedByRole: ev.plannedByRole,
        plannedByName,
        plannedAt: ev.plannedAt,
      });
    } catch (e) {
      console.error("GET /schedule/events/:id", e);
      res.status(500).json({ error: "Sunucu hatası" });
    }
  }
);

export default router;
