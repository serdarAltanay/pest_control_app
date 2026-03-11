// routes/stores.js
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { auth, roleCheck } from "../middleware/auth.js";
import bcrypt from "bcrypt";
import { randomInt } from "crypto";
import { sendAccessOwnerWelcome, sendAccessOwnerGranted } from "../lib/mailer.js";

const router = Router();
const prisma = new PrismaClient();

/* ---------------- helpers ---------------- */

const norm = (s) => (typeof s === "string" ? s.trim() : s);
const asEnum = (val, allowed, fallback) =>
  allowed.includes(String(val)) ? String(val) : fallback;

const stripVowels = (s) => (s || "").replace(/[aeıioöuüAEIİOÖUÜ\s]/g, "").toUpperCase();

const basicCheck = (body) => {
  if (!norm(body.name)) return "Mağaza adı zorunludur.";
  if (body.phone) {
    const digits = String(body.phone).replace(/\D/g, "");
    if (digits.length > 0 && digits.length < 10)
      return "Telefon hatalı görünüyor.";
  }
  if (body.code && String(body.code).length > 12)
    return "Kod en fazla 12 karakter olmalı.";
  return null;
};

const random6 = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

const ALLOWED_ACCESS_ROLES = [
  "CALISAN",
  "MAGAZA_SORUMLUSU",
  "MAGAZA_MUDURU",
  "GENEL_MUDUR",
  "PATRON",
  "DIGER",
];

// AccessOwner yardımcıları
async function ensureAccessOwner({ email, role, firstName, lastName, phone }) {
  const trimmedEmail = String(email).trim().toLowerCase();
  let owner = await prisma.accessOwner.findUnique({
    where: { email: trimmedEmail },
  });
  let created = false;

  if (!owner) {
    const code = random6();
    const password = await bcrypt.hash(code, 10);
    const safeRole = ALLOWED_ACCESS_ROLES.includes(role) ? role : "MAGAZA_SORUMLUSU";
    owner = await prisma.accessOwner.create({
      data: {
        email: trimmedEmail,
        password,
        role: safeRole,
        firstName: (firstName || "").trim() || null,
        lastName: (lastName || "").trim() || null,
        phone: phone || null,
        isActive: true,
      },
    });
    created = true;

    try {
      const display =
        [owner.firstName, owner.lastName].filter(Boolean).join(" ") ||
        owner.email;
      await sendAccessOwnerWelcome({ to: owner.email, name: display, code });
    } catch { }
  }
  return { owner, created };
}

/**
 * BUG FIX: AccessOwner login’inde JWT role "customer" ve id doğrudan AccessOwner.id.
 * Bunu öncelikli olarak kullanıyoruz. Diğer olasılıkları yedek bırakıyoruz.
 */
async function resolveOwnerId(req) {
  if (req.user?.role === "customer") {
    const n = Number(req.user.id);
    if (Number.isFinite(n) && n > 0) return n;
  }
  if (req.user?.ownerId) {
    const n = Number(req.user.ownerId);
    if (Number.isFinite(n) && n > 0) return n;
  }
  if (req.user?.email) {
    const ow = await prisma.accessOwner.findUnique({
      where: { email: String(req.user.email).toLowerCase() },
      select: { id: true },
    });
    if (ow) return ow.id;
  }
  return null;
}

async function collectAccessibleStoreIds(ownerId) {
  if (!ownerId) return [];
  const grants = await prisma.accessGrant.findMany({
    where: { ownerId },
    select: { scopeType: true, storeId: true, customerId: true },
  });

  const storeIds = new Set();
  for (const g of grants) {
    if (g.scopeType === "STORE" && g.storeId) storeIds.add(g.storeId);
  }
  const customerIds = grants
    .filter((g) => g.scopeType === "CUSTOMER" && g.customerId)
    .map((g) => g.customerId);

  if (customerIds.length) {
    const stores = await prisma.store.findMany({
      where: { customerId: { in: customerIds } },
      select: { id: true },
    });
    for (const s of stores) storeIds.add(s.id);
  }
  return Array.from(storeIds);
}

async function customerCanAccessStore(req, storeId) {
  if (["admin", "employee"].includes(req.user?.role)) return true; // employee → full read access
  if (req.user?.role === "customer") {
    const ownerId = await resolveOwnerId(req);
    const ids = await collectAccessibleStoreIds(ownerId);
    return ids.includes(Number(storeId));
  }
  return false;
}

/* ---------------- routes ---------------- */

// === CUSTOMER: kendi mağazaları (liste) ===
router.get("/mine", auth, async (req, res) => {
  try {
    if (req.user?.role !== "customer")
      return res.status(403).json({ message: "Yetkisiz" });

    const ownerId = await resolveOwnerId(req);
    if (!ownerId) {
      console.warn("GET /stores/mine -> ownerId bulunamadı");
      return res.json([]);
    }

    const storeIds = await collectAccessibleStoreIds(ownerId);
    if (!storeIds.length) return res.json([]);

    const stores = await prisma.store.findMany({
      where: { id: { in: storeIds }, code: { not: "FREE" } },
      select: {
        id: true,
        name: true,
        code: true,
        shortName: true,
        isActive: true,
        city: true,
        _count: {
          select: { Visit: true, nonconformities: true },
        },
      },
    });
    return res.json(stores);
  } catch (e) {
    console.error("GET /stores/mine", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

// === CUSTOMER: ?scope=self → {items:[]} ===
router.get("/", auth, async (req, res, next) => {
  try {
    if (req.query.scope !== "self") return next();
    if (req.user?.role !== "customer")
      return res.status(403).json({ message: "Yetkisiz" });

    const ownerId = await resolveOwnerId(req);
    if (!ownerId) {
      return res.json({ items: [] });
    }

    const storeIds = await collectAccessibleStoreIds(ownerId);
    if (!storeIds.length) return res.json({ items: [] });

    // Ekran için gerekli minimum data
    const stores = await prisma.store.findMany({
      where: { id: { in: storeIds }, code: { not: "FREE" } },
      select: {
        id: true,
        name: true,
        code: true,
        shortName: true,
        city: true,
        isActive: true,
        _count: {
          select: { Visit: true, nonconformities: true },
        },
        updatedAt: true,   // ✨ eklendi
      },
    });
    return res.json({ items: stores });
  } catch (e) {
    console.error("GET /stores?scope=self", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

// Arama (admin/employee)
router.get(
  "/search",
  auth,
  roleCheck(["admin", "employee"]),
  async (req, res) => {
    try {
      const q = (req.query.q || "").toString().trim();

      if (!q) {
        const latest = await prisma.store.findMany({
          where: { code: { not: "FREE" } },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            name: true,
            code: true,
            shortName: true,
            city: true,
            phone: true,
            manager: true,
            isActive: true,
            createdAt: true, // (opsiyonel)
          },
        });
        return res.json(latest);
      }

      const list = await prisma.store.findMany({
        where: { AND: [{ OR: [{ name: { contains: q } }, { code: { contains: q } }] }, { code: { not: "FREE" } }] },
        orderBy: { name: "asc" },
        take: 30,
        select: {
          id: true,
          name: true,
          code: true,
          shortName: true,
          city: true,
          phone: true,
          manager: true,
          isActive: true,
          createdAt: true, // (opsiyonel)
        },
      });

      res.json(list);
    } catch (e) {
      console.error("GET /stores/search", e);
      res.status(500).json({ message: "Sunucu hatası" });
    }
  }
);

// Belirli müşterinin mağazaları (admin/employee)
router.get(
  "/customer/:customerId",
  auth,
  roleCheck(["admin", "employee"]),
  async (req, res) => {
    try {
      const customerId = Number(req.params.customerId);
      if (!customerId) return res.status(400).json({ message: "Geçersiz müşteri" });

      const list = await prisma.store.findMany({
        where: { customerId, code: { not: "FREE" } },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          code: true,
          shortName: true,
          city: true,
          address: true,
          phone: true,
          manager: true,
          isActive: true,
          latitude: true,
          longitude: true,
          customerId: true,
          createdAt: true,   // ✨ eklendi
          updatedAt: true,   // ✨ eklendi
        },
      });
      res.json(list);
    } catch (e) {
      console.error("GET /stores/customer/:customerId", e);
      res.status(500).json({ message: "Sunucu hatası" });
    }
  }
);

// Min (admin/employee)
router.get(
  "/min",
  auth,
  roleCheck(["admin", "employee"]),
  async (_req, res) => {
    try {
      const list = await prisma.store.findMany({
        where: { code: { not: "FREE" } },
        select: { id: true, name: true, code: true, latitude: true, longitude: true },
        orderBy: { id: "asc" },
      });

      const items = list
        .filter((s) => s.latitude != null && s.longitude != null)
        .map((s) => {
          const lat = Number(s.latitude);
          const lng = Number(s.longitude);
          return {
            id: s.id,
            name: s.name || s.code || `Mağaza #${s.id}`,
            lat: Number.isFinite(lat) ? lat : null,
            lng: Number.isFinite(lng) ? lng : null,
          };
        })
        .filter((s) => s.lat != null && s.lng != null);

      return res.json({ ok: true, stores: items });
    } catch (e) {
      console.error("GET /stores/min", e);
      return res.status(500).json({ ok: false, message: "Sunucu hatası" });
    }
  }
);

// Tek mağaza: admin/employee serbest; customer → grant gerekli
router.get("/:id", auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Geçersiz id" });

    if (!(await customerCanAccessStore(req, id))) {
      return res.status(403).json({ message: "Bu mağazaya erişim izniniz yok" });
    }

    const store = await prisma.store.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, title: true } },
        _count: {
          select: {
            Visit: true,
            stations: true,
            reports: true,
            nonconformities: true,
          },
        },
      },
    });
    if (!store) return res.status(404).json({ message: "Mağaza bulunamadı" });
    res.json(store);
  } catch (e) {
    console.error("GET /stores/:id", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/** 🆕 CUSTOMER/EMPLOYEE/ADMIN: mağaza ziyaretleri (alias’sız) 
 * GET /api/stores/:storeId/visits
 * employee → kısıt YOK (tam okuma)
 */
router.get("/:storeId/visits", auth, async (req, res) => {
  try {
    const storeId = Number(req.params.storeId);
    if (!storeId) return res.status(400).json({ message: "Geçersiz storeId" });

    // employee serbest, customer grant kontrolü:
    if (!(await customerCanAccessStore(req, storeId))) {
      return res.status(403).json({ message: "Yetkisiz" });
    }

    const items = await prisma.visit.findMany({
      where: { storeId },
      orderBy: { date: "desc" },
      select: {
        id: true, storeId: true, date: true, startTime: true, endTime: true,
        visitType: true, notes: true, employees: true,
      },
    });
    res.json(items);
  } catch (e) {
    console.error("GET /stores/:storeId/visits", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

// CREATE (admin/employee)
router.post("/", auth, roleCheck(["admin", "employee"]), async (req, res) => {
  try {
    const {
      customerId,
      name,
      city,
      address,
      phone,
      manager,
      isActive,
      pestType,
      placeType,
      visitPeriod,
      areaM2,
      latitude,
      longitude,
      grantAccess,
      accessOwner,
      shortName,
    } = req.body;

    const vErr = basicCheck({ name, phone }); // code check removed since we generate it
    if (vErr) return res.status(400).json({ message: vErr });
    if (!Number(customerId))
      return res.status(400).json({ message: "Geçersiz müşteri" });

    // Parent customer'ı bul (kodunu almak için)
    const customer = await prisma.customer.findUnique({
      where: { id: Number(customerId) },
      select: { code: true }
    });
    if (!customer) return res.status(404).json({ message: "Müşteri bulunamadı" });

    // Mağaza kodu oluşturma [MüşteriKodu]-[0001]
    const existingStores = await prisma.store.findMany({
      where: { customerId: Number(customerId), code: { not: "FREE" } },
      select: { code: true }
    });

    const prefix = (customer.code || "00000").padStart(5, "0");
    let nextSuffix = 1;
    if (existingStores.length > 0) {
      const suffixes = existingStores
        .map(s => {
          const parts = (s.code || "").split("-");
          return parts.length > 1 ? parseInt(parts[1], 10) : 0;
        })
        .filter(n => !isNaN(n));
      if (suffixes.length > 0) {
        nextSuffix = Math.max(...suffixes) + 1;
      }
    }
    const finalCode = `${prefix}-${String(nextSuffix).padStart(4, "0")}`;

    // Kısaltma oluşturma (vowels strip)
    const finalShortName = (shortName && String(shortName).trim() ? String(shortName).trim() : stripVowels(name)).substring(0, 12);

    const data = {
      customerId: Number(customerId),
      name: String(name),
      code: finalCode,
      shortName: finalShortName,
      city: city ?? null,
      address: address ?? null,
      phone: phone ?? null,
      manager: manager ?? null,
      isActive: isActive !== undefined ? !!isActive : true,
      pestType: ["KEMIRGEN", "HACCADI", "UCAN", "BELIRTILMEDI"].includes(pestType)
        ? pestType
        : "BELIRTILMEDI",
      placeType: ["OFIS", "DEPO", "MAGAZA", "FABRIKA", "BELIRTILMEDI"].includes(placeType)
        ? placeType
        : "BELIRTILMEDI",
      visitPeriod: ["HAFTALIK", "IKIHAFTALIK", "AYLIK", "IKIAYLIK", "UCAYLIK", "BELIRTILMEDI"].includes(visitPeriod)
        ? visitPeriod
        : "BELIRTILMEDI",
      areaM2: areaM2 != null ? Number(areaM2) : null,
      latitude: latitude != null ? Number(latitude) : null,
      longitude: longitude != null ? Number(longitude) : null,
    };

    const created = await prisma.store.create({ data });

    if (grantAccess && accessOwner?.email) {
      const safeRole = ALLOWED_ACCESS_ROLES.includes(String(accessOwner.role))
        ? String(accessOwner.role)
        : "MAGAZA_SORUMLUSU";

      const firstName =
        (accessOwner.firstName || "").trim() ||
        (manager ? String(manager).split(" ")[0] : "");
      const lastName =
        (accessOwner.lastName || "").trim() ||
        (manager ? String(manager).split(" ").slice(1).join(" ") : "");

      // ensureAccessOwner already sends Welcome email. To do it atomically, we will just use it as is for now, but wait!
      // Since changing ensureAccessOwner might break other things, we can just inline the owner creation here like we did in access.js to be completely sure we only send 1 email.
      const trimmedEmail = String(accessOwner.email).trim().toLowerCase();
      let owner = await prisma.accessOwner.findUnique({ where: { email: trimmedEmail } });
      let isNewCreator = false;
      let rawPassword = null;

      if (!owner) {
        rawPassword = random6();
        const pwhash = await bcrypt.hash(rawPassword, 10);
        owner = await prisma.accessOwner.create({
          data: {
            email: trimmedEmail,
            password: pwhash,
            role: safeRole,
            firstName: firstName || null,
            lastName: lastName || null,
            phone: accessOwner.phone || null,
            isActive: true,
          },
        });
        isNewCreator = true;
      }

      const exists = await prisma.accessGrant.findFirst({
        where: { ownerId: owner.id, scopeType: "STORE", storeId: created.id },
      });

      if (!exists) {
        await prisma.accessGrant.create({
          data: { ownerId: owner.id, scopeType: "STORE", storeId: created.id },
        });

        if (isNewCreator) {
          try {
            const scopeText = `Mağaza (${created.name || created.id})`;
            const display =
              [owner.firstName, owner.lastName].filter(Boolean).join(" ") ||
              owner.email;

            const { sendAccessOwnerWelcomeAndGranted } = await import("../lib/mailer.js");
            await sendAccessOwnerWelcomeAndGranted({
              to: owner.email,
              name: display,
              code: rawPassword,
              scopeText
            }).catch(() => { });
          } catch { }
        }
      }
    }

    res.json(created);
  } catch (e) {
    console.error("POST /stores", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

// UPDATE (admin/employee)
router.put("/:storeId", auth, roleCheck(["admin", "employee"]), async (req, res) => {
  try {
    const id = Number(req.params.storeId);
    if (!id) return res.status(400).json({ message: "Geçersiz id" });

    const body = req.body;
    const data = {};
    if ("name" in body) data.name = String(body.name);
    if ("code" in body) data.code = body.code ?? null;
    if ("shortName" in body) {
      const inputSN = body.shortName && String(body.shortName).trim();
      if (inputSN) {
        data.shortName = inputSN.substring(0, 12);
      } else {
        // Eğer boş gönderildiyse veya null ise isimden türet (veya mevcut ismi kullan)
        const targetName = data.name || (await prisma.store.findUnique({ where: { id }, select: { name: true } }))?.name || "";
        data.shortName = stripVowels(targetName).substring(0, 12);
      }
    }
    if ("city" in body) data.city = body.city ?? null;
    if ("address" in body) data.address = body.address ?? null;
    if ("phone" in body) data.phone = body.phone ?? null;
    if ("manager" in body) data.manager = body.manager ?? null;
    if ("isActive" in body) data.isActive = !!body.isActive;
    if ("pestType" in body)
      data.pestType = asEnum(
        body.pestType,
        ["KEMIRGEN", "HACCADI", "UCAN", "BELIRTILMEDI"],
        "BELIRTILMEDI"
      );
    if ("placeType" in body)
      data.placeType = asEnum(
        body.placeType,
        ["OFIS", "DEPO", "MAGAZA", "FABRIKA", "BELIRTILMEDI"],
        "BELIRTILMEDI"
      );
    if ("visitPeriod" in body)
      data.visitPeriod = asEnum(
        body.visitPeriod,
        ["HAFTALIK", "IKIHAFTALIK", "AYLIK", "IKIAYLIK", "UCAYLIK", "BELIRTILMEDI"],
        "BELIRTILMEDI"
      );
    if ("areaM2" in body) data.areaM2 = body.areaM2 != null ? Number(body.areaM2) : null;
    if ("latitude" in body) data.latitude = body.latitude != null ? Number(body.latitude) : null;
    if ("longitude" in body) data.longitude = body.longitude != null ? Number(body.longitude) : null;

    const updated = await prisma.store.update({ where: { id }, data });
    res.json(updated);
  } catch (e) {
    console.error("PUT /stores/:id", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

// DELETE (admin)
router.delete("/:id", auth, roleCheck(["admin"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Geçersiz id" });
    await prisma.store.delete({ where: { id } });
    res.json({ message: "Mağaza silindi" });
  } catch (e) {
    if (e.code === "P2025")
      return res.status(404).json({ message: "Mağaza bulunamadı" });
    console.error("DELETE /stores/:id", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

export default router;
