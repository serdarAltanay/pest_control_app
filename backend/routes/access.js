import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { auth, roleCheck } from "../middleware/auth.js";

const prisma = new PrismaClient();
const router = Router();

/* -------------- helpers -------------- */
const toId = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

async function principalSummary(type, id) {
  try {
    if (type === "EMPLOYEE") {
      const p = await prisma.employee.findUnique({ where: { id } });
      if (!p) return null;
      return { id: p.id, type, name: p.fullName, email: p.email, role: "employee" };
    }
    if (type === "CUSTOMER") {
      const c = await prisma.customer.findUnique({ where: { id } });
      if (!c) return null;
      return { id: c.id, type, name: c.title, email: c.email, role: "customer" };
    }
    if (type === "ADMIN") {
      const a = await prisma.admin.findUnique({ where: { id } });
      if (!a) return null;
      return { id: a.id, type, name: a.fullName, email: a.email, role: "admin" };
    }
  } catch {}
  return null;
}

async function expandGrant(g) {
  const principal = await principalSummary(g.principalType, g.principalId);
  let scopeLabel = "-";
  let customer = null;
  let store = null;

  if (g.scopeType === "CUSTOMER" && g.customerId) {
    customer = await prisma.customer.findUnique({ where: { id: g.customerId } });
    scopeLabel = `Müşteri: ${customer?.title || g.customerId}`;
  }
  if (g.scopeType === "STORE" && g.storeId) {
    store = await prisma.store.findUnique({ where: { id: g.storeId }, include: { customer: true } });
    scopeLabel = `Mağaza: ${store?.name || g.storeId}`;
  }

  return {
    id: g.id,
    principalType: g.principalType,
    principalId: g.principalId,
    scopeType: g.scopeType,
    customerId: g.customerId,
    storeId: g.storeId,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
    principal,
    store: store ? { id: store.id, name: store.name, code: store.code } : null,
    customer: customer
      ? { id: customer.id, title: customer.title, code: customer.code }
      : (store?.customer ? { id: store.customer.id, title: store.customer.title, code: store.customer.code } : null),
    scopeLabel,
  };
}

/* -------------- validators -------------- */
function validateCreate(body) {
  const principalType = String(body.principalType || "").toUpperCase();
  const scopeType = String(body.scopeType || "").toUpperCase();
  const principalId = toId(body.principalId);
  const customerId = body.customerId ? toId(body.customerId) : null;
  const storeId = body.storeId ? toId(body.storeId) : null;

  if (!["EMPLOYEE", "CUSTOMER", "ADMIN"].includes(principalType)) return { error: "Geçersiz principalType" };
  if (!["CUSTOMER", "STORE"].includes(scopeType)) return { error: "Geçersiz scopeType" };
  if (!principalId) return { error: "principalId gerekli" };
  if (scopeType === "CUSTOMER" && !customerId) return { error: "customerId gerekli" };
  if (scopeType === "STORE" && !storeId) return { error: "storeId gerekli" };

  return { principalType, principalId, scopeType, customerId, storeId };
}

/* -------------- routes -------------- */

// Tüm grant’lar (opsiyonel filtreler)
router.get("/grants", auth, roleCheck(["admin", "employee"]), async (req, res) => {
  try {
    const where = {};
    if (req.query.principalType) where.principalType = String(req.query.principalType).toUpperCase();
    if (req.query.principalId) where.principalId = toId(req.query.principalId) || undefined;
    if (req.query.scopeType) where.scopeType = String(req.query.scopeType).toUpperCase();
    if (req.query.customerId) where.customerId = toId(req.query.customerId) || undefined;
    if (req.query.storeId) where.storeId = toId(req.query.storeId) || undefined;

    const rows = await prisma.accessGrant.findMany({ where, orderBy: { updatedAt: "desc" } });
    const out = await Promise.all(rows.map(expandGrant));
    res.json(out);
  } catch (e) {
    console.error("GET /access/grants", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

// STORE için efektif erişim: direkt STORE + aynı müşteriye CUSTOMER kapsamındakiler
router.get("/store/:storeId", auth, roleCheck(["admin", "employee"]), async (req, res) => {
  try {
    const storeId = toId(req.params.storeId);
    if (!storeId) return res.status(400).json({ message: "Geçersiz storeId" });

    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store) return res.status(404).json({ message: "Mağaza bulunamadı" });

    const direct = await prisma.accessGrant.findMany({
      where: { scopeType: "STORE", storeId },
      orderBy: { updatedAt: "desc" },
    });
    const inherited = await prisma.accessGrant.findMany({
      where: { scopeType: "CUSTOMER", customerId: store.customerId },
      orderBy: { updatedAt: "desc" },
    });

    const rows = [...direct, ...inherited];
    const out = await Promise.all(rows.map(expandGrant));
    res.json(out);
  } catch (e) {
    console.error("GET /access/store/:storeId", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

// CUSTOMER için erişimler: CUSTOMER kapsamı + bu müşterinin mağazalarına özel STORE kapsamı
router.get("/customer/:customerId", auth, roleCheck(["admin", "employee"]), async (req, res) => {
  try {
    const customerId = toId(req.params.customerId);
    if (!customerId) return res.status(400).json({ message: "Geçersiz customerId" });

    const stores = await prisma.store.findMany({ where: { customerId }, select: { id: true, name: true } });
    const storeIds = stores.map(s => s.id);

    const customerGrants = await prisma.accessGrant.findMany({
      where: { scopeType: "CUSTOMER", customerId },
      orderBy: { updatedAt: "desc" },
    });

    const storeGrants = storeIds.length
      ? await prisma.accessGrant.findMany({
          where: { scopeType: "STORE", storeId: { in: storeIds } },
          orderBy: { updatedAt: "desc" },
        })
      : [];

    const rows = [...customerGrants, ...storeGrants];
    const out = await Promise.all(rows.map(expandGrant));
    res.json(out);
  } catch (e) {
    console.error("GET /access/customer/:customerId", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

// PRINCIPAL (kişi) detay: bu kişinin tüm grant’ları
router.get("/principal/:type/:id", auth, roleCheck(["admin", "employee"]), async (req, res) => {
  try {
    const principalType = String(req.params.type || "").toUpperCase();
    const principalId = toId(req.params.id);
    if (!["EMPLOYEE", "CUSTOMER", "ADMIN"].includes(principalType)) {
      return res.status(400).json({ message: "Geçersiz principal type" });
    }
    if (!principalId) return res.status(400).json({ message: "Geçersiz principalId" });

    const grants = await prisma.accessGrant.findMany({
      where: { principalType, principalId },
      orderBy: { updatedAt: "desc" },
    });
    const out = await Promise.all(grants.map(expandGrant));
    const principal = await principalSummary(principalType, principalId);
    res.json({ principal, grants: out });
  } catch (e) {
    console.error("GET /access/principal/:type/:id", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

// CREATE (grant)
router.post("/grant", auth, roleCheck(["admin", "employee"]), async (req, res) => {
  try {
    const v = validateCreate(req.body || {});
    if (v.error) return res.status(400).json({ message: v.error });

    // scope varlık kontrolü
    if (v.scopeType === "CUSTOMER") {
      const c = await prisma.customer.findUnique({ where: { id: v.customerId } });
      if (!c) return res.status(404).json({ message: "Müşteri bulunamadı" });
    }
    if (v.scopeType === "STORE") {
      const s = await prisma.store.findUnique({ where: { id: v.storeId } });
      if (!s) return res.status(404).json({ message: "Mağaza bulunamadı" });
    }

    const created = await prisma.accessGrant.create({
      data: {
        principalType: v.principalType,
        principalId: v.principalId,
        scopeType: v.scopeType,
        customerId: v.customerId,
        storeId: v.storeId,
      },
    });
    res.json(await expandGrant(created));
  } catch (e) {
    if (e.code === "P2002") return res.status(409).json({ message: "Bu erişim zaten tanımlı." });
    console.error("POST /access/grant", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

// DELETE (revoke)
router.delete("/:id", auth, roleCheck(["admin", "employee"]), async (req, res) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ message: "Geçersiz id" });
    await prisma.accessGrant.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === "P2025") return res.status(404).json({ message: "Kayıt bulunamadı" });
    console.error("DELETE /access/:id", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

export default router;
