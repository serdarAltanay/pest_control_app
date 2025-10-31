// routes/visits.js
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { auth, roleCheck } from "../middleware/auth.js";
import { sendMail } from "../lib/mailer.js";

const prisma = new PrismaClient();
const router = Router();

/* ───────── helpers ───────── */
const parseId = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const isIsoDate = (v) => !!v && !Number.isNaN(Date.parse(v));
const asDate = (v) => (v instanceof Date ? v : new Date(v));
const roleRank = { MAGAZA_SORUMLUSU:1, MAGAZA_MUDURU:2, GENEL_MUDUR:3, PATRON:4, CALISAN:5, DIGER:6 };

async function ensureEmployeeStoreAccess(_req, _storeId) {
  return true; // yazma serbest (ileride kısıt eklenebilir)
}

/** Customer (AccessOwner) → store erişim kontrolü (grant) */
async function customerHasStoreAccess(req, storeId) {
  const role = String(req.user?.role || "").toLowerCase();
  if (["admin", "employee"].includes(role)) return true;
  if (role !== "customer") return false;

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

function normalizeEmployeesField(employees) {
  if (!employees) return "—";
  if (typeof employees === "string") return employees.trim() || "—";

  if (typeof employees === "object" && !Array.isArray(employees)) {
    const o = employees || {};
    const s =
      o.fullName ||
      o.name ||
      [o.firstName, o.lastName].filter(Boolean).join(" ") ||
      o.email ||
      "";
    return s || "—";
  }

  if (Array.isArray(employees)) {
    const names = employees
      .map((e) => {
        if (!e) return "";
        if (typeof e === "string") return e;
        const o = e || {};
        return (
          o.fullName ||
          o.name ||
          [o.firstName, o.lastName].filter(Boolean).join(" ") ||
          o.email ||
          ""
        );
      })
      .filter(Boolean);
    return names.length ? names.join(", ") : "—";
  }

  return "—";
}
function normalizeTargetPestsField(targetPests) {
  if (!targetPests) return "";
  if (Array.isArray(targetPests)) return targetPests.join(", ");
  if (typeof targetPests === "string") return targetPests;
  return "";
}
function fmtDateTR(d) {
  try {
    return new Date(d).toLocaleString("tr-TR", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit"
    });
  } catch { return String(d); }
}

/* Basit HTML sarmalayıcı */
const APP_NAME = process.env.APP_NAME || "Pest Control";
const APP_URL  = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/,"");

function baseBox(innerHtml) {
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.6;color:#0f172a;">
    <div style="max-width:600px;margin:0 auto;padding:16px 12px;">
      ${innerHtml}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0 8px"/>
      <div style="font-size:12px;color:#64748b;">
        <div>${APP_NAME}</div>
        <div><a href="${APP_URL}" target="_blank" style="color:#2563eb;text-decoration:none">${APP_URL}</a></div>
      </div>
    </div>
  </div>`;
}

/* Ziyaret + ekleri (mail içeriklerinde ortak) */
async function loadVisitFullForMail(_req, id) {
  const v = await prisma.visit.findUnique({
    where: { id },
    include: {
      store: {
        select: {
          id: true, name: true, code: true, customerId: true,
          customer: { select: { id: true, title: true, email: true, code: true } },
        }
      },
      ek1: true,
      ek1Lines: { include: { biosidal: true } },
      activations: true,
    },
  });
  if (!v) return null;
  return v;
}

/* Alıcı listesi (mağaza ve müşteri-genel) */
async function resolveRecipientsForStore(storeId, customerId) {
  const direct = await prisma.accessGrant.findMany({
    where: { scopeType: "STORE", storeId },
    include: { owner: true },
  });
  const inherited = await prisma.accessGrant.findMany({
    where: { scopeType: "CUSTOMER", customerId },
    include: { owner: true },
  });
  let owners = [...direct, ...inherited]
    .map(g => g.owner)
    .filter(o => o?.isActive && o?.email)
    .sort((a,b) => (roleRank[a.role]||99) - (roleRank[b.role]||99));

  const seen = new Set();
  owners = owners.filter(o => (o.email && !seen.has(o.email) && seen.add(o.email)));

  return owners.map(o => ({
    id: o.id,
    email: o.email,
    firstName: o.firstName || "",
    lastName: o.lastName || "",
    fullName: `${o.firstName || ""} ${o.lastName || ""}`.trim() || o.email,
    role: o.role || "DIGER",
  }));
}

/* Özet data üret (mail içerik için sade) */
function buildSummaryData(v) {
  const lines = (v.ek1Lines || []).map(l => ({
    name: l.biosidal?.name || "—",
    activeIngredient: l.biosidal?.activeIngredient || "—",
    unit: l.biosidal?.unit || "",
    method: l.method,
    amount: l.amount,
  }));

  const typeMap = new Map();
  (v.activations || []).forEach(a => {
    const key = String(a.type);
    typeMap.set(key, (typeMap.get(key) || 0) + 1);
  });
  const activations = Array.from(typeMap.entries()).map(([k, count]) => ({
    label: k.replace(/_/g," ").toLowerCase().replace(/\b\w/g, s => s.toUpperCase()),
    count,
  }));

  return {
    storeName: v.store?.name,
    storeCode: v.store?.code,
    customerTitle: v.store?.customer?.title,
    visitAt: v.date,
    startTime: v.startTime || "",
    endTime: v.endTime || "",
    visitType: v.visitType || "",
    employees: normalizeEmployeesField(v.employees),
    targetPests: normalizeTargetPestsField(v.targetPests),
    notes: v.notes || "",
    ek1Status: v.ek1?.status || "",
    pdfUrl: v.ek1?.pdfUrl || "",
    detailUrl: `${APP_URL}/calendar/visit/${v.id}`,
    lines,
    activations,
  };
}

/* ───────── LIST: filters (from,to, storeId, customerId) ───────── */
router.get(
  "/",
  auth,
  roleCheck(["admin", "employee"]),
  async (req, res) => {
    try {
      const { from, to, storeId, customerId } = req.query || {};
      const where = {};

      if (isIsoDate(from) || isIsoDate(to)) {
        where.date = {};
        if (isIsoDate(from)) where.date.gte = asDate(from);
        if (isIsoDate(to))   where.date.lte = asDate(to);
      }

      if (storeId) {
        const sid = parseId(storeId);
        if (!sid) return res.status(400).json({ message: "Geçersiz storeId" });
        where.storeId = sid;
      }

      if (customerId) {
        const cid = parseId(customerId);
        if (!cid) return res.status(400).json({ message: "Geçersiz customerId" });
        where.store = { customerId: cid };
      }

      const rows = await prisma.visit.findMany({
        where,
        orderBy: { date: "asc" },
        select: {
          id: true, storeId: true, date: true, startTime: true, endTime: true,
          visitType: true, notes: true, employees: true,
          store: { select: { name: true, code: true } }
        },
      });

      const data = rows.map(r => ({
        id: r.id,
        storeId: r.storeId,
        storeName: r.store?.name || "",
        storeCode: r.store?.code || "",
        date: r.date,
        startTime: r.startTime || "",
        endTime: r.endTime || "",
        visitType: r.visitType || "",
        employees: normalizeEmployeesField(r.employees),
        notes: r.notes || "",
      }));

      res.json(data);
    } catch (e) {
      console.error("GET /visits error:", e);
      res.status(500).json({ message: "Sunucu hatası" });
    }
  }
);

/* ───────── LIST by store (customer’a da açık) ───────── */
router.get(
  "/store/:storeId",
  auth,
  roleCheck(["admin", "employee", "customer"]),
  async (req, res) => {
    try {
      const storeId = parseId(req.params.storeId);
      if (!storeId) return res.status(400).json({ message: "Geçersiz storeId" });

      const role = String(req.user.role || "").toLowerCase();
      if (role === "customer") {
        const ok = await customerHasStoreAccess(req, storeId);
        if (!ok) return res.status(403).json({ message: "Yetkisiz" });
      }

      const items = await prisma.visit.findMany({
        where: { storeId },
        orderBy: { date: "desc" },
        select: {
          id: true, storeId: true, date: true, startTime: true, endTime: true,
          visitType: true, notes: true, employees: true,
        },
      });

      const data = items.map(v => ({
        ...v,
        employees: normalizeEmployeesField(v.employees),
      }));

      res.json(data);
    } catch (e) {
      console.error("GET /visits/store/:storeId", e);
      res.status(500).json({ message: "Sunucu hatası" });
    }
  }
);

/* ───────── GET one (zengin include) ───────── */
router.get(
  "/:id",
  auth,
  roleCheck(["admin", "employee"]),
  async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ message: "Geçersiz id" });

      const v = await prisma.visit.findUnique({
        where: { id },
        include: {
          ek1: true,
          ek1Lines: { include: { biosidal: true } },
          store: {
            select: {
              id: true, name: true, code: true,
              customer: { select: { id: true, title: true, email: true } }
            }
          },
          activations: true,
        },
      });
      if (!v) return res.status(404).json({ message: "Bulunamadı" });

      res.json(v);
    } catch (e) {
      console.error("GET /visits/:id", e);
      res.status(500).json({ message: "Sunucu hatası" });
    }
  }
);

/* ───────── CREATE (EK-1 = DRAFT) ───────── */
router.post(
  "/",
  auth,
  roleCheck(["admin", "employee"]),
  async (req, res) => {
    try {
      const { storeId, date, startTime, endTime, visitType, targetPests, notes, employees } = req.body;
      const sid = parseId(storeId);
      if (!sid || !date || !visitType) {
        return res.status(400).json({ message: "storeId, date, visitType zorunlu" });
      }

      await ensureEmployeeStoreAccess(req, sid);

      const visit = await prisma.visit.create({
        data: {
          storeId: sid,
          date: new Date(date),
          startTime: startTime ?? null,
          endTime: endTime ?? null,
          visitType,
          targetPests: targetPests ?? null,
          notes: notes ?? null,
          employees: employees ?? null,
          ek1: { create: {} }, // status default: DRAFT
        },
        include: { ek1: true },
      });
      res.json({ message: "Ziyaret oluşturuldu", visit });
    } catch (e) {
      console.error("POST /visits", e);
      res.status(500).json({ message: "Sunucu hatası" });
    }
  }
);

/* ───────── UPDATE ───────── */
router.put(
  "/:id",
  auth,
  roleCheck(["admin", "employee"]),
  async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ message: "Geçersiz id" });

      const existing = await prisma.visit.findUnique({ where: { id }, select: { storeId: true } });
      if (!existing) return res.status(404).json({ message: "Bulunamadı" });

      await ensureEmployeeStoreAccess(req, existing.storeId);

      const data = {};
      ["date", "startTime", "endTime", "visitType", "targetPests", "notes", "employees"].forEach((k) => {
        if (k in req.body) data[k] = k === "date" ? new Date(req.body[k]) : req.body[k];
      });

      const visit = await prisma.visit.update({ where: { id }, data });
      res.json({ message: "Güncellendi", visit });
    } catch (e) {
      console.error("PUT /visits/:id", e);
      res.status(500).json({ message: "Sunucu hatası" });
    }
  }
);

/* ───────── DELETE (admin) ───────── */
router.delete(
  "/:id",
  auth,
  roleCheck(["admin"]),
  async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ message: "Geçersiz id" });
      await prisma.visit.delete({ where: { id } });
      res.json({ message: "Silindi" });
    } catch (e) {
      if (e.code === "P2025") return res.status(404).json({ message: "Bulunamadı" });
      console.error("DELETE /visits/:id", e);
      res.status(500).json({ message: "Sunucu hatası" });
    }
  }
);

/* ───────── EK-1: satır ekle ───────── */
router.post(
  "/:id/ek1-line",
  auth,
  roleCheck(["admin", "employee"]),
  async (req, res) => {
    try {
      const visitId = parseId(req.params.id);
      if (!visitId) return res.status(400).json({ message: "Geçersiz id" });

      const v = await prisma.visit.findUnique({ where: { id: visitId }, select: { storeId: true } });
      if (!v) return res.status(404).json({ message: "Ziyaret bulunamadı" });

      await ensureEmployeeStoreAccess(req, v.storeId);

      const { biosidalId, method, amount } = req.body;
      const bid = parseId(biosidalId);
      if (!bid || !method || typeof amount !== "number") {
        return res.status(400).json({ message: "biosidalId, method, amount zorunlu" });
      }

      const line = await prisma.ek1Line.create({
        data: { visitId, biosidalId: bid, method, amount },
        include: { biosidal: true },
      });
      res.json({ message: "EK-1 satırı eklendi", line });
    } catch (e) {
      console.error("POST /visits/:id/ek1-line", e);
      res.status(500).json({ message: "Sunucu hatası" });
    }
  }
);

/* ───────── EK-1: satır sil ───────── */
router.delete(
  "/:id/ek1-line/:lineId",
  auth,
  roleCheck(["admin", "employee"]),
  async (req, res) => {
    try {
      const visitId = parseId(req.params.id);
      const lineId  = parseId(req.params.lineId);
      if (!visitId || !lineId) return res.status(400).json({ message: "Geçersiz id" });

      const line = await prisma.ek1Line.findUnique({
        where: { id: lineId },
        select: { visit: { select: { storeId: true, id: true } } },
      });
      if (!line || line.visit.id !== visitId) return res.status(404).json({ message: "Bulunamadı" });

      await ensureEmployeeStoreAccess(req, line.visit.storeId);

      await prisma.ek1Line.delete({ where: { id: lineId } });
      res.json({ message: "EK-1 satırı silindi" });
    } catch (e) {
      console.error("DELETE /visits/:id/ek1-line/:lineId", e);
      res.status(500).json({ message: "Sunucu hatası" });
    }
  }
);

/* ───────── EK-1: rapor güncelle (status, pdfUrl, imzalar) ───────── */
router.put(
  "/:id/ek1",
  auth,
  roleCheck(["admin", "employee"]),
  async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ message: "Geçersiz id" });

      const v = await prisma.visit.findUnique({ where: { id }, select: { storeId: true, ek1: { select: { id: true } } } });
      if (!v) return res.status(404).json({ message: "Ziyaret bulunamadı" });

      await ensureEmployeeStoreAccess(req, v.storeId);

      const data = {};
      const fields = ["status","pdfUrl","providerSignedAt","providerSignerName","customerSignedAt","customerSignerName"];
      fields.forEach((k) => {
        if (k in req.body) data[k] = /At$/.test(k) && req.body[k] ? new Date(req.body[k]) : req.body[k];
      });

      const ek1 = await prisma.ek1Report.update({
        where: { visitId: id },
        data,
      });

      res.json({ message: "EK-1 güncellendi", ek1 });
    } catch (e) {
      console.error("PUT /visits/:id/ek1", e);
      res.status(500).json({ message: "Sunucu hatası" });
    }
  }
);

/* ───────── SUMMARY (UI için) ───────── */
router.get(
  "/:id/summary",
  auth,
  roleCheck(["admin","employee"]),
  async (req,res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ message:"Geçersiz id" });

      const v = await prisma.visit.findUnique({
        where: { id },
        include: {
          ek1: true,
          ek1Lines: { include: { biosidal: true } },
          activations: true,
          store: {
            select: {
              id: true, name: true, code: true, customerId: true,
              customer: { select: { id: true, title: true, email: true } },
            }
          },
        },
      });
      if (!v) return res.status(404).json({ message: "Ziyaret bulunamadı" });

      const lines = (v.ek1Lines || []).map(l => ({
        name: l.biosidal?.name || "—",
        activeIngredient: l.biosidal?.activeIngredient || "—",
        unit: l.biosidal?.unit || "",
        method: l.method,
        amount: l.amount,
      }));

      const typeMap = new Map();
      (v.activations || []).forEach(a => {
        const key = String(a.type);
        typeMap.set(key, (typeMap.get(key) || 0) + 1);
      });
      const activations = Array.from(typeMap.entries()).map(([k, count]) => ({
        label: k.replace(/_/g," ").toLowerCase().replace(/\b\w/g, s=>s.toUpperCase()),
        count,
      }));

      const data = {
        storeName: v.store?.name,
        storeCode: v.store?.code,
        customerTitle: v.store?.customer?.title,
        visitAt: v.date,
        startTime: v.startTime || "",
        endTime: v.endTime || "",
        visitType: v.visitType || "",
        employees: normalizeEmployeesField(v.employees),
        targetPests: normalizeTargetPestsField(v.targetPests),
        notes: v.notes || "",
        ek1Status: v.ek1?.status || "",
        pdfUrl: v.ek1?.pdfUrl || "",
        lines,
        activations,
        detail: {
          dateTR: fmtDateTR(v.date),
          storeId: v.storeId,
          customerId: v.store?.customerId,
        }
      };

      res.json(data);
    } catch (e) {
      console.error("GET /visits/:id/summary", e);
      res.status(500).json({ message: "Sunucu hatası" });
    }
  }
);

/* ───────── E-POSTA: erişim sahiplerine ziyaret özeti ───────── */
router.post(
  "/:id/email-summary",
  auth,
  roleCheck(["admin","employee"]),
  async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ message: "Geçersiz id" });

      const v = await loadVisitFullForMail(req, id);
      if (!v) return res.status(404).json({ message: "Ziyaret bulunamadı" });

      let recipients = [];
      if (req.body?.to) {
        recipients = [String(req.body.to).trim().toLowerCase()];
      } else {
        const owners = await resolveRecipientsForStore(v.storeId, v.store.customerId);
        recipients = owners.map(o => o.email);
        if (recipients.length === 0 && v.store.customer?.email) {
          recipients = [v.store.customer.email];
        }
      }
      if (recipients.length === 0) {
        return res.status(400).json({ message: "Gönderilecek e-posta adresi bulunamadı" });
      }

      const d = buildSummaryData(v);
      const subject = `Ziyaret Özeti – ${v.store?.name} (${fmtDateTR(v.date)})`;
      const linesHtml = d.lines?.length
        ? `<table style="width:100%;border-collapse:collapse;margin:10px 0;">
            <thead><tr>
              <th style="text-align:left;border-bottom:1px solid #e5e7eb;padding:6px 4px;">Biyosidal</th>
              <th style="text-align:left;border-bottom:1px solid #e5e7eb;padding:6px 4px;">Etken</th>
              <th style="text-align:left;border-bottom:1px solid #e5e7eb;padding:6px 4px;">Yöntem</th>
              <th style="text-align:left;border-bottom:1px solid #e5e7eb;padding:6px 4px;">Miktar</th>
            </tr></thead>
            <tbody>
              ${d.lines.map(l => `
                <tr>
                  <td style="border-bottom:1px solid #f1f5f9;padding:6px 4px;">${l.name}</td>
                  <td style="border-bottom:1px solid #f1f5f9;padding:6px 4px;">${l.activeIngredient}</td>
                  <td style="border-bottom:1px solid #f1f5f9;padding:6px 4px;">${l.method}</td>
                  <td style="border-bottom:1px solid #f1f5f9;padding:6px 4px;">${l.amount} ${l.unit || ""}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>`
        : "<p>Bu ziyarette malzeme/uygulama satırı bulunmuyor.</p>";

      const actsHtml = d.activations?.length
        ? `<p style="margin:8px 0;">Uygulama/aktivasyon özetleri: ${
            d.activations.map(a => `${a.label}: ${a.count}`).join(", ")
          }</p>`
        : "";

      const html = baseBox(`
        <h2 style="margin:0 0 10px;font-size:18px;">Ziyaret Bilgilendirme</h2>
        <p><b>${d.storeName}</b> lokasyonunda <b>${fmtDateTR(d.visitAt)}</b> tarihinde gerçekleştirilen ziyarette ait bilgiler aşağıdadır.</p>
        <ul style="margin:8px 0 12px; padding-left:18px;">
          <li><b>Hizmet Saati:</b> ${d.startTime || "—"} – ${d.endTime || "—"}</li>
          <li><b>Hizmeti Veren Personel:</b> ${d.employees}</li>
          ${d.targetPests ? `<li><b>Hedef Zararlılar:</b> ${d.targetPests}</li>` : ""}
          ${d.notes ? `<li><b>Notlar:</b> ${d.notes}</li>` : ""}
        </ul>
        ${actsHtml}
        ${linesHtml}
        ${d.pdfUrl ? `<p>Ek-1 PDF: <a href="${d.pdfUrl}" target="_blank" style="color:#2563eb">Görüntüle/İndir</a></p>` : ""}
        <p>Detay sayfası: <a href="${d.detailUrl}" target="_blank" style="color:#2563eb">${d.detailUrl}</a></p>
      `);

      const text =
`Ziyaret Bilgilendirme
Lokasyon: ${d.storeName}
Tarih: ${fmtDateTR(d.visitAt)}
Saat: ${d.startTime || "—"} – ${d.endTime || "—"}
Personel: ${d.employees}
${d.targetPests ? `Hedef Zararlılar: ${d.targetPests}\n` : ""}${d.notes ? `Notlar: ${d.notes}\n` : ""}${(d.activations||[]).map(a => `${a.label}: ${a.count}`).join(", ")}
${(d.lines||[]).map(l => `- ${l.name} / ${l.activeIngredient} / ${l.method} / ${l.amount} ${l.unit || ""}`).join("\n")}
${d.pdfUrl ? `Ek-1 PDF: ${d.pdfUrl}\n` : ""}Detay: ${d.detailUrl}`;

      await sendMail({ to: recipients.join(","), subject, html, text });
      res.json({ ok: true, to: recipients, sent: true });
    } catch (e) {
      console.error("POST /visits/:id/email-summary", e);
      res.status(500).json({ message: "E-posta gönderilemedi" });
    }
  }
);

export default router;
