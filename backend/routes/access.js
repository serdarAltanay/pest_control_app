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
import { isEmailTaken } from "../lib/user-utils.js";

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

// ⚠️ AccessOwner için profileImage seçilmiyor
const grantInclude = {
  owner: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      // profileImage: true,  // ← BİLEREK YOK
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
 * POST /api/access/owners/ensure   (KANONİK)
 * Alias: /api/access-owners/ensure
 * body: { email*, role?, firstName?, lastName?, phone?, forceReset? }
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
      const taken = await isEmailTaken(prisma, trimmedEmail);
      if (taken) return res.status(409).json({ message: "E-posta kullanımda (başka bir kullanıcı türünde olabilir)." });

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
      }).catch((err) => { console.error("Yeni kullanıcı karşılama maili hatası:", err); });
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
      }).catch(() => { });
      emailed = true;
    }

    // ⚠️ Dönüşte de profileImage alanı yok
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
router.post("/owners/ensure", auth, roleCheck(["admin", "employee"]), ensureOwnerHandler);
// ✅ Alias rotası düzeltildi (önceden '/../...' idi)
router.post("/access-owners/ensure", auth, roleCheck(["admin", "employee"]), ensureOwnerHandler);

/* -------------------- owner detail + grants -------------------- */
/**
 * GET /api/access/owner/:id
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
        include: grantInclude, // profileImage dahil değil
      });

      res.json({ owner, grants });
    } catch (e) {
      console.error("GET /access/owner/:id error:", e);
      res.status(500).json({ message: "Sunucu hatası" });
    }
  }
);

/* -------------------- reset password (yalnız admin) -------------------- */
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

      const payload = { ok: true, emailed };
      if (reveal) payload.code = code;

      res.json(payload);
    } catch (e) {
      console.error("POST /access/owner/:ownerId/reset-password", e);
      res.status(500).json({ message: "Sunucu hatası" });
    }
  }
);

/* -------------------- completely delete owner (yalnız admin) -------------------- */
router.delete(
  "/owner/:ownerId",
  auth,
  roleCheck(["admin"]),
  async (req, res) => {
    try {
      const ownerId = toId(req.params.ownerId);
      if (!ownerId) return res.status(400).json({ message: "Geçersiz id" });

      const owner = await prisma.accessOwner.findUnique({ where: { id: ownerId } });
      if (!owner) return res.status(404).json({ message: "Erişim sahibi bulunamadı" });

      await prisma.accessOwner.delete({ where: { id: ownerId } });

      res.json({ ok: true, message: "Kullanıcı başarıyla silindi" });
    } catch (e) {
      console.error("DELETE /access/owner/:ownerId error:", e);
      res.status(500).json({ message: "Sunucu hatası" });
    }
  }
);

/* -------------------- grants list (filters) -------------------- */
router.get(
  "/grants",
  auth,
  roleCheck(["admin", "employee"]),
  async (req, res) => {
    try {
      const where = {};
      if (req.query.ownerId) where.ownerId = toId(req.query.ownerId) || undefined;
      if (req.query.scopeType) where.scopeType = String(req.query.scopeType).toUpperCase();
      if (req.query.customerId) where.customerId = toId(req.query.customerId) || undefined;
      if (req.query.storeId) where.storeId = toId(req.query.storeId) || undefined;

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
router.get(
  "/customer/:customerId",
  auth,
  roleCheck(["admin", "employee"]),
  async (req, res) => {
    try {
      const customerId = toId(req.params.customerId);
      if (!customerId) return res.status(400).json({ message: "Geçersiz customerId" });

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

/* -------------------- create grant (admin + employee) -------------------- */
router.post(
  "/grant",
  auth,
  roleCheck(["admin", "employee"]),
  async (req, res) => {
    try {
      const scopeType = String(req.body.scopeType || "").toUpperCase();

      const rawCustomerIds = req.body.customerIds || (req.body.customerId ? [req.body.customerId] : []);
      const rawStoreIds = req.body.storeIds || (req.body.storeId ? [req.body.storeId] : []);
      const customerIds = Array.isArray(rawCustomerIds) ? rawCustomerIds.map(toId).filter(Boolean) : [];
      const storeIds = Array.isArray(rawStoreIds) ? rawStoreIds.map(toId).filter(Boolean) : [];

      if (!["CUSTOMER", "STORE"].includes(scopeType))
        return res.status(400).json({ message: "Geçersiz scopeType" });
      if (scopeType === "CUSTOMER" && customerIds.length === 0)
        return res.status(400).json({ message: "En az bir müşteri gerekli" });
      if (scopeType === "STORE" && storeIds.length === 0)
        return res.status(400).json({ message: "En az bir mağaza gerekli" });

      let ownerId = toId(req.body.ownerId);
      let owner = null;
      let isNewCreator = false;
      let rawPassword = null;

      if (ownerId) {
        owner = await prisma.accessOwner.findUnique({ where: { id: ownerId } });
      } else if (req.body.email) {
        const trimmedEmail = String(req.body.email).trim().toLowerCase();
        owner = await prisma.accessOwner.findUnique({ where: { email: trimmedEmail } });

        if (!owner) {
          const taken = await isEmailTaken(prisma, trimmedEmail);
          if (taken) return res.status(409).json({ message: "E-posta kullanımda (başka bir kullanıcı türünde olabilir)." });

          rawPassword = random6();
          const pwhash = await bcrypt.hash(rawPassword, 10);
          owner = await prisma.accessOwner.create({
            data: {
              email: trimmedEmail,
              password: pwhash,
              role: normRole(req.body.role),
              firstName: req.body.firstName || null,
              lastName: req.body.lastName || null,
              phone: req.body.phone || null,
              isActive: true,
            },
          });
          isNewCreator = true;
        }
        ownerId = owner.id;
      }

      if (!owner) return res.status(404).json({ message: "Owner bulunamadı" });

      const createdGrants = [];

      if (scopeType === "CUSTOMER") {
        for (const cid of customerIds) {
          const c = await prisma.customer.findUnique({ where: { id: cid } });
          if (!c) continue;

          let exists = await prisma.accessGrant.findFirst({
            where: { ownerId: owner.id, scopeType: "CUSTOMER", customerId: cid },
            include: grantInclude
          });

          if (!exists) {
            const created = await prisma.accessGrant.create({
              data: { ownerId: owner.id, scopeType: "CUSTOMER", customerId: cid },
            });
            exists = await prisma.accessGrant.findUnique({
              where: { id: created.id },
              include: grantInclude
            });
          }
          createdGrants.push(exists);
        }
      } else {
        for (const sid of storeIds) {
          const s = await prisma.store.findUnique({ where: { id: sid } });
          if (!s) continue;

          let exists = await prisma.accessGrant.findFirst({
            where: { ownerId: owner.id, scopeType: "STORE", storeId: sid },
            include: grantInclude
          });

          if (!exists) {
            const created = await prisma.accessGrant.create({
              data: { ownerId: owner.id, scopeType: "STORE", storeId: sid },
            });
            exists = await prisma.accessGrant.findUnique({
              where: { id: created.id },
              include: grantInclude
            });
          }
          createdGrants.push(exists);
        }
      }

      // SADECE YENİ OLUŞTURULDUYSA TEK BİR KOMBİNE MAİL ATILIR. MEVCUT KULLANICIYA MAİL ATILMAZ.
      if (isNewCreator && createdGrants.length > 0) {
        try {
          const scopeText = scopeType === "CUSTOMER"
            ? (customerIds.length === 1 && createdGrants[0]?.customer ? `Müşteri (${createdGrants[0].customer.title})` : `${customerIds.length} Müşteri`)
            : (storeIds.length === 1 && createdGrants[0]?.store ? `Mağaza (${createdGrants[0].store.name})` : `${storeIds.length} Mağaza`);

          const display = [owner.firstName, owner.lastName].filter(Boolean).join(" ") || owner.email;

          const { sendAccessOwnerWelcomeAndGranted } = await import("../lib/mailer.js");
          await sendAccessOwnerWelcomeAndGranted({
            to: owner.email,
            name: display,
            code: rawPassword,
            scopeText,
          }).catch((err) => { console.error("Kombine hoşgeldin maili hatası:", err); });
        } catch (err) { console.error("Genel mail blogu hatasi:", err); }
      }

      res.json(createdGrants);
    } catch (e) {
      console.error("POST /access/grant", e);
      res.status(500).json({ message: "Sunucu hatası" });
    }
  }
);

/* -------------------- delete grant (admin + employee) -------------------- */
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
