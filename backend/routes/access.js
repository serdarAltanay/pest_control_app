// routes/access.js
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { auth, roleCheck } from "../middleware/auth.js";
import bcrypt from "bcrypt";
import { randomInt } from "crypto";
import {
  sendAccessOwnerWelcome,
  sendAccessOwnerGranted,
  sendAccessOwnerPasswordReset,
} from "../lib/mailer.js";

const prisma = new PrismaClient();
const router = Router();

/* -------------------- helpers -------------------- */
const toId = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const random6 = () => String(randomInt(0, 1_000_000)).padStart(6, "0");
const allowedRoles = [
  "CALISAN",
  "MAGAZA_SORUMLUSU",
  "MAGAZA_MUDURU",
  "GENEL_MUDUR",
  "PATRON",
  "DIGER",
];
const normRole = (r) =>
  allowedRoles.includes(String(r || "").toUpperCase())
    ? String(r).toUpperCase()
    : "CALISAN";

const grantInclude = {
  owner: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      profileImage: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      lastSeenAt: true,
      updatedAt: true,
      createdAt: true,
    },
  },
  customer: { select: { id: true, title: true, code: true } },
  store: { select: { id: true, name: true, code: true } },
};

/* -------------------- ensure owner (with mail) -------------------- */
/**
 * POST /api/access/owners/ensure   (ANA)
 *    body: { email*, role?, firstName?, lastName?, phone?, forceReset? }
 * Alias:  /api/access-owners/ensure (eski FE çağrılarını kırmamak için)
 *
 * - yoksa: 6 haneli şifre üretir, hash’leyip kaydeder, HOŞ GELDİN maili yollar
 * - varsa: forceReset=true ise yeni 6 haneli üretip günceller, HOŞ GELDİN (reset) maili yollar
 * - dönen: { id, email, role, firstName, lastName, phone, isActive, created, emailed }
 */
async function ensureOwnerHandler(req, res) {
  try {
    const {
      email,
      role = "CALISAN",
      firstName,
      lastName,
      phone,
      forceReset = false,
    } = req.body || {};

    if (!email || !String(email).trim()) {
      return res.status(400).json({ message: "E-posta gerekli" });
    }
    const trimmedEmail = String(email).trim().toLowerCase();
    const safeRole = normRole(role);

    let owner = await prisma.accessOwner.findUnique({
      where: { email: trimmedEmail },
    });

    let created = false;
    let emailed = false;

    if (!owner) {
      const code = random6();
      const password = await bcrypt.hash(code, 10);
      owner = await prisma.accessOwner.create({
        data: {
          email: trimmedEmail,
          password,
          role: safeRole,
          firstName: firstName || null,
          lastName: lastName || null,
          phone: phone || null,
          isActive: true,
        },
      });
      created = true;

      const display =
        [firstName, lastName].filter(Boolean).join(" ") || trimmedEmail;
      await sendAccessOwnerWelcome({
        to: trimmedEmail,
        name: display,
        code,
      }).catch(() => {});
      emailed = true;
    } else if (forceReset) {
      const code = random6();
      const password = await bcrypt.hash(code, 10);
      owner = await prisma.accessOwner.update({
        where: { id: owner.id },
        data: { password, updatedAt: new Date() },
      });

      const display =
        [owner.firstName, owner.lastName].filter(Boolean).join(" ") ||
        owner.email;
      await sendAccessOwnerWelcome({
        to: owner.email,
        name: display,
        code,
      }).catch(() => {});
      emailed = true;
    }

    return res.json({
      id: owner.id,
      email: owner.email,
      role: owner.role,
      firstName: owner.firstName,
      lastName: owner.lastName,
      phone: owner.phone,
      isActive: owner.isActive,
      created,
      emailed,
    });
  } catch (e) {
    console.error("POST /access/owners/ensure error:", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
}
router.post(
  "/owners/ensure",
  auth,
  roleCheck(["admin", "employee"]),
  ensureOwnerHandler
);
// Eski FE çağrılarını kırmamak için alias:
router.post(
  "/../access-owners/ensure", // NOT: router base'i /api/access ise -> /api/access/../access-owners/ensure => /api/access-owners/ensure
  auth,
  roleCheck(["admin", "employee"]),
  ensureOwnerHandler
);

/* -------------------- owner detail + grants -------------------- */
/**
 * GET /api/access/owner/:id
 * - owner tüm alanları + grant listesi
 */
router.get(
  "/owner/:id",
  auth,
  roleCheck(["admin", "employee"]),
  async (req, res) => {
    try {
      const id = toId(req.params.id);
      if (!id) return res.status(400).json({ message: "Geçersiz id" });

      const owner = await prisma.accessOwner.findUnique({ where: { id } });
      if (!owner) return res.status(404).json({ message: "Owner bulunamadı" });

      const grants = await prisma.accessGrant.findMany({
        where: { ownerId: id },
        orderBy: { createdAt: "desc" },
        include: grantInclude,
      });

      res.json({ owner, grants });
    } catch (e) {
      console.error("GET /access/owner/:id error:", e);
      res.status(500).json({ message: "Sunucu hatası" });
    }
  }
);

// routes/access.js

router.post(
  "/owner/:ownerId/reset-password",
  auth,
  roleCheck(["admin"]),
  async (req, res) => {
    try {
      const ownerId = toId(req.params.ownerId);
      if (!ownerId) return res.status(400).json({ message: "Geçersiz id" });

      const { reveal = false, notify = true } = req.body || {};

      const owner = await prisma.accessOwner.findUnique({ where: { id: ownerId } });
      if (!owner) return res.status(404).json({ message: "Erişim sahibi bulunamadı" });

      const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
      const password = await bcrypt.hash(code, 10);

      await prisma.accessOwner.update({
        where: { id: ownerId },
        data: { password, updatedAt: new Date() },
      });

      let emailed = false;
      if (notify) {
        try {
          const name = [owner.firstName, owner.lastName].filter(Boolean).join(" ") || owner.email;
          await sendAccessOwnerPasswordReset({ to: owner.email, name, code });
          emailed = true;
        } catch (err) {
          console.warn("reset-password mail error:", err?.message || err);
        }
      }

      // DİKKAT: plaintext kodu DB'ye yazmıyoruz; yalnızca bu yanıtta döndürülüyor.
      const payload = { ok: true, emailed };
      if (reveal) payload.code = code;

      res.json(payload);
    } catch (e) {
      console.error("POST /access/owner/:ownerId/reset-password", e);
      res.status(500).json({ message: "Sunucu hatası" });
    }
  }
);


/* -------------------- grants list (filters) -------------------- */
/**
 * GET /api/access/grants?ownerId=&scopeType=&customerId=&storeId=
 */
router.get(
  "/grants",
  auth,
  roleCheck(["admin", "employee"]),
  async (req, res) => {
    try {
      const where = {};
      if (req.query.ownerId) where.ownerId = toId(req.query.ownerId) || undefined;
      if (req.query.scopeType)
        where.scopeType = String(req.query.scopeType).toUpperCase();
      if (req.query.customerId)
        where.customerId = toId(req.query.customerId) || undefined;
      if (req.query.storeId)
        where.storeId = toId(req.query.storeId) || undefined;

      const rows = await prisma.accessGrant.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        include: grantInclude,
      });
      res.json(rows);
    } catch (e) {
      console.error("GET /access/grants", e);
      res.status(500).json({ message: "Sunucu hatası" });
    }
  }
);

/* -------------------- effective access for store -------------------- */
/**
 * GET /api/access/store/:storeId
 * - Doğrudan STORE grant’ları + aynı customer'sa CUSTOMER grant’ları
 */
router.get(
  "/store/:storeId",
  auth,
  roleCheck(["admin", "employee"]),
  async (req, res) => {
    try {
      const storeId = toId(req.params.storeId);
      if (!storeId) return res.status(400).json({ message: "Geçersiz storeId" });

      const store = await prisma.store.findUnique({ where: { id: storeId } });
      if (!store) return res.status(404).json({ message: "Mağaza bulunamadı" });

      const [direct, inherited] = await Promise.all([
        prisma.accessGrant.findMany({
          where: { scopeType: "STORE", storeId },
          orderBy: { updatedAt: "desc" },
          include: grantInclude,
        }),
        prisma.accessGrant.findMany({
          where: { scopeType: "CUSTOMER", customerId: store.customerId },
          orderBy: { updatedAt: "desc" },
          include: grantInclude,
        }),
      ]);

      res.json([...direct, ...inherited]);
    } catch (e) {
      console.error("GET /access/store/:storeId", e);
      res.status(500).json({ message: "Sunucu hatası" });
    }
  }
);

/* -------------------- effective access for customer -------------------- */
/**
 * GET /api/access/customer/:customerId
 * - CUSTOMER grant’ları + bu müşterinin mağazalarına ait STORE grant’ları
 */
router.get(
  "/customer/:customerId",
  auth,
  roleCheck(["admin", "employee"]),
  async (req, res) => {
    try {
      const customerId = toId(req.params.customerId);
      if (!customerId)
        return res.status(400).json({ message: "Geçersiz customerId" });

      const stores = await prisma.store.findMany({
        where: { customerId },
        select: { id: true },
      });
      const storeIds = stores.map((s) => s.id);

      const [customerGrants, storeGrants] = await Promise.all([
        prisma.accessGrant.findMany({
          where: { scopeType: "CUSTOMER", customerId },
          orderBy: { updatedAt: "desc" },
          include: grantInclude,
        }),
        storeIds.length
          ? prisma.accessGrant.findMany({
              where: { scopeType: "STORE", storeId: { in: storeIds } },
              orderBy: { updatedAt: "desc" },
              include: grantInclude,
            })
          : Promise.resolve([]),
      ]);

      res.json([...customerGrants, ...storeGrants]);
    } catch (e) {
      console.error("GET /access/customer/:customerId", e);
      res.status(500).json({ message: "Sunucu hatası" });
    }
  }
);

/* -------------------- create grant -------------------- */
/**
 * POST /api/access/grant
 * body: { ownerId*, scopeType*: "CUSTOMER"|"STORE", customerId?, storeId? }
 * - aynı grant varsa tekrar oluşturmaz
 * - başarıyla olursa bilgilendirme maili gönderir
 */
router.post(
  "/grant",
  auth,
  roleCheck(["admin", "employee"]),
  async (req, res) => {
    try {
      const ownerId = toId(req.body.ownerId);
      const scopeType = String(req.body.scopeType || "").toUpperCase();
      const customerId = req.body.customerId ? toId(req.body.customerId) : null;
      const storeId = req.body.storeId ? toId(req.body.storeId) : null;

      if (!ownerId) return res.status(400).json({ message: "ownerId gerekli" });
      if (!["CUSTOMER", "STORE"].includes(scopeType))
        return res.status(400).json({ message: "Geçersiz scopeType" });
      if (scopeType === "CUSTOMER" && !customerId)
        return res.status(400).json({ message: "customerId gerekli" });
      if (scopeType === "STORE" && !storeId)
        return res.status(400).json({ message: "storeId gerekli" });

      const owner = await prisma.accessOwner.findUnique({ where: { id: ownerId } });
      if (!owner) return res.status(404).json({ message: "Owner bulunamadı" });

      if (scopeType === "CUSTOMER") {
        const c = await prisma.customer.findUnique({ where: { id: customerId } });
        if (!c) return res.status(404).json({ message: "Müşteri bulunamadı" });
      } else {
        const s = await prisma.store.findUnique({ where: { id: storeId } });
        if (!s) return res.status(404).json({ message: "Mağaza bulunamadı" });
      }

      const exists = await prisma.accessGrant.findFirst({
        where: { ownerId, scopeType, customerId, storeId },
      });
      const created = exists
        ? exists
        : await prisma.accessGrant.create({
            data: { ownerId, scopeType, customerId, storeId },
          });

      const expanded = await prisma.accessGrant.findUnique({
        where: { id: created.id },
        include: grantInclude,
      });

      // bilgilendirme maili (best-effort)
      try {
        const scopeText =
          scopeType === "CUSTOMER"
            ? `Müşteri (${expanded.customer?.title || expanded.customerId})`
            : `Mağaza (${expanded.store?.name || expanded.storeId})`;
        const display =
          [expanded.owner?.firstName, expanded.owner?.lastName]
            .filter(Boolean)
            .join(" ") || expanded.owner?.email;
        await sendAccessOwnerGranted({
          to: expanded.owner?.email,
          name: display,
          scopeText,
        }).catch(() => {});
      } catch {}

      res.json(expanded);
    } catch (e) {
      console.error("POST /access/grant", e);
      res.status(500).json({ message: "Sunucu hatası" });
    }
  }
);

/* -------------------- delete grant -------------------- */
/**
 * DELETE /api/access/:id
 */
router.delete(
  "/:id",
  auth,
  roleCheck(["admin", "employee"]),
  async (req, res) => {
    try {
      const id = toId(req.params.id);
      if (!id) return res.status(400).json({ message: "Geçersiz id" });
      await prisma.accessGrant.delete({ where: { id } });
      res.json({ ok: true });
    } catch (e) {
      if (e.code === "P2025")
        return res.status(404).json({ message: "Kayıt bulunamadı" });
      console.error("DELETE /access/:id", e);
      res.status(500).json({ message: "Sunucu hatası" });
    }
  }
);

export default router;
