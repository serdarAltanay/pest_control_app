// routes/feedback.js
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import multer from "multer";
import path from "path";
import fs from "fs";
import { auth, roleCheck } from "../middleware/auth.js";
import {
  sendComplaintCreatedToAdmins,
  sendSuggestionCreatedToAdmins,
} from "../lib/mailer.js";

const prisma = new PrismaClient();
const router = Router();

/* ------------- Upload config (complaint image) ------------- */
const UPLOAD_ROOT = path.join(process.cwd(), "uploads");
const COMPLAINT_DIR = path.join(UPLOAD_ROOT, "complaints");
for (const dir of [UPLOAD_ROOT, COMPLAINT_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
const fileFilter = (_req, file, cb) => {
  const ok = ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.mimetype);
  cb(ok ? null : new Error("Geçersiz görsel türü (png/jpg/jpeg/webp)"), ok);
};
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, COMPLAINT_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const who = `${req.user?.role || "user"}-${req.user?.id || "x"}`;
    cb(null, `complaint-${who}-${Date.now()}${ext}`);
  },
});
const upload = multer({ storage, fileFilter, limits: { fileSize: 8 * 1024 * 1024 } });
const rel = (abs) => path.relative(process.cwd(), abs).split(path.sep).join("/");

/* ------------- Helpers ------------- */
const toId = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

async function getAccessibleStoresForOwner(ownerId) {
  const grants = await prisma.accessGrant.findMany({
    where: { ownerId },
    select: { scopeType: true, customerId: true, storeId: true },
  });

  const storeIds = new Set();

  // STORE grant'ları
  for (const g of grants) {
    if (g.scopeType === "STORE" && g.storeId) storeIds.add(g.storeId);
  }

  // CUSTOMER grant'ları => bu müşterinin tüm mağazaları
  const customerIds = grants.filter(g => g.scopeType === "CUSTOMER" && g.customerId).map(g => g.customerId);
  if (customerIds.length) {
    const stores = await prisma.store.findMany({
      where: { customerId: { in: customerIds } },
      select: { id: true },
    });
    stores.forEach(s => storeIds.add(s.id));
  }

  if (storeIds.size === 0) return [];
  return prisma.store.findMany({
    where: { id: { in: [...storeIds] } },
    select: { id: true, name: true, code: true, city: true, address: true, customerId: true },
    orderBy: { name: "asc" },
  });
}

/* ========== CUSTOMER: erişebildiğim mağazalar ========== */
router.get("/customer/my-stores", auth, roleCheck(["customer"]), async (req, res) => {
  try {
    const stores = await getAccessibleStoresForOwner(req.user.id);
    res.json(stores);
  } catch (e) {
    console.error("GET /feedback/customer/my-stores", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/* ========== CUSTOMER: şikayet oluştur (image destekli) ========== */
router.post("/complaints", auth, roleCheck(["customer"]), upload.single("image"), async (req, res) => {
  try {
    const { type, storeId, title, message, employeeName } = req.body || {};
    const sId = toId(storeId);
    if (!type || !sId || !title || !message) {
      if (req.file?.path) fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: "Zorunlu alanlar eksik" });
    }

    // erişim doğrulaması
    const stores = await getAccessibleStoresForOwner(req.user.id);
    const allowed = stores.find(s => s.id === sId);
    if (!allowed) {
      if (req.file?.path) fs.unlinkSync(req.file.path);
      return res.status(403).json({ message: "Bu mağaza için yetkiniz yok" });
    }

    let imageRel = null;
    if (req.file?.path) imageRel = rel(req.file.path);

    const created = await prisma.complaint.create({
      data: {
        ownerId: req.user.id,
        customerId: allowed.customerId,
        storeId: sId,
        type: String(type).toUpperCase(),
        title: String(title),
        message: String(message),
        employeeName: employeeName ? String(employeeName) : null,
        image: imageRel,
      },
    });

    // Bildirimler (in-app)
    await prisma.notification.create({
      data: {
        type: "COMPLAINT_NEW",
        title: "Yeni Şikayet",
        body: `${title} (Mağaza #${sId})`,
        link: `/admin/complaints/${created.id}`,
        recipientRole: "ADMIN",
      },
    }).catch(() => {});

    await prisma.notification.create({
      data: {
        type: "COMPLAINT_NEW",
        title: "Şikayetiniz Alındı",
        body: title,
        link: `/customer/complaints/${created.id}`,
        recipientRole: "CUSTOMER",
        recipientId: req.user.id,
      },
    }).catch(() => {});

    // ---- E-POSTA: Admin’lere gönder ----
    const admins = await prisma.admin.findMany({ select: { email: true, fullName: true } });
    const to = admins.map(a => a.email).filter(Boolean);
    if (to.length) {
      // mağaza & sahibi daha zengin bilgi
      const store = await prisma.store.findUnique({
        where: { id: sId },
        select: { id: true, name: true, code: true, city: true, address: true }
      });
      const owner = await prisma.accessOwner.findUnique({
        where: { id: req.user.id },
        select: { id: true, email: true, firstName: true, lastName: true }
      });

      await sendComplaintCreatedToAdmins({
        to,
        complaint: {
          id: created.id,
          title,
          message,
          type: String(type).toUpperCase(),
          image: imageRel,
          createdAt: created.createdAt,
          store,
          owner,
        },
        // FE'de admin detay rotası
        detailPath: `/admin/complaints/${created.id}`,
      }).catch((err) => {
        console.warn("MAIL complaint notify failed:", err?.message);
      });
    }

    res.json({ ok: true, id: created.id });
  } catch (e) {
    console.error("POST /feedback/complaints", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/* ========== CUSTOMER: şikayetlerim ========== */
router.get("/complaints/me", auth, roleCheck(["customer"]), async (req, res) => {
  try {
    const rows = await prisma.complaint.findMany({
      where: { ownerId: req.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, type: true, title: true, createdAt: true, adminSeenAt: true,
        store: { select: { id: true, name: true, code: true, city: true } },
      },
    });
    res.json(rows);
  } catch (e) {
    console.error("GET /feedback/complaints/me", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/* ========== CUSTOMER/ADMIN: şikayet detay ==========
   ⚠ Personel erişimi YOK. */
router.get("/complaints/:id", auth, roleCheck(["customer", "admin"]), async (req, res) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ message: "Geçersiz id" });

    const row = await prisma.complaint.findUnique({
      where: { id },
      include: {
        store: { select: { id: true, name: true, code: true, city: true, address: true } },
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
    if (!row) return res.status(404).json({ message: "Kayıt bulunamadı" });

    // müşteri ise sadece kendi kaydı
    if (req.user.role === "customer" && row.ownerId !== req.user.id) {
      return res.status(403).json({ message: "Yetkisiz erişim" });
    }

    // admin ilk görüntülemede seen işaretle
    if (req.user.role === "admin" && !row.adminSeenAt) {
      await prisma.complaint.update({ where: { id }, data: { adminSeenAt: new Date() } }).catch(() => {});
      await prisma.notification.create({
        data: {
          type: "COMPLAINT_SEEN",
          title: "Şikayet Görüldü",
          body: row.title,
          link: `/admin/complaints/${row.id}`,
          recipientRole: "ADMIN",
        },
      }).catch(() => {});
    }

    res.json(row);
  } catch (e) {
    console.error("GET /feedback/complaints/:id", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/* ========== ADMIN: tüm şikayetler listesi (sadece admin) ========== */
router.get("/admin/complaints", auth, roleCheck(["admin"]), async (req, res) => {
  try {
    const seen = req.query.seen;
    const where = {};
    if (seen === "true") where.adminSeenAt = { not: null };
    if (seen === "false") where.adminSeenAt = null;

    const rows = await prisma.complaint.findMany({
      where,
      orderBy: [{ adminSeenAt: "asc" }, { createdAt: "desc" }],
      select: {
        id: true, type: true, title: true, createdAt: true, adminSeenAt: true,
        store: { select: { id: true, name: true, code: true, city: true } },
        owner: { select: { id: true, email: true, firstName: true, lastName: true } }
      },
    });
    res.json(rows);
  } catch (e) {
    console.error("GET /feedback/admin/complaints", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/* ========== ADMIN: şikayet detay (görüntülemede seen) ========== */
router.get("/admin/complaints/:id", auth, roleCheck(["admin"]), async (req, res) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ message: "Geçersiz id" });

    let row = await prisma.complaint.findUnique({
      where: { id },
      include: {
        store: { select: { id: true, name: true, code: true, city: true, address: true } },
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
    if (!row) return res.status(404).json({ message: "Kayıt bulunamadı" });

    if (!row.adminSeenAt) {
      await prisma.complaint.update({ where: { id }, data: { adminSeenAt: new Date() } }).catch(() => {});
      row = await prisma.complaint.findUnique({
        where: { id },
        include: {
          store: { select: { id: true, name: true, code: true, city: true, address: true } },
          owner: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      });
    }

    res.json(row);
  } catch (e) {
    console.error("GET /feedback/admin/complaints/:id", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/* ========== CUSTOMER: öneri oluştur (JSON) ========== */
router.post("/suggestions", auth, roleCheck(["customer"]), async (req, res) => {
  try {
    const { title, message } = req.body || {};
    if (!title || !message) return res.status(400).json({ message: "Zorunlu alanlar eksik" });

    const created = await prisma.suggestion.create({
      data: { ownerId: req.user.id, title: String(title), message: String(message) },
    });

    await prisma.notification.create({
      data: {
        type: "SUGGESTION_NEW",
        title: "Yeni Öneri",
        body: title,
        link: `/admin/suggestions/${created.id}`,
        recipientRole: "ADMIN",
      },
    }).catch(() => {});

    // ---- E-POSTA: Admin’lere gönder ----
    const admins = await prisma.admin.findMany({ select: { email: true } });
    const to = admins.map(a => a.email).filter(Boolean);
    if (to.length) {
      const owner = await prisma.accessOwner.findUnique({
        where: { id: req.user.id },
        select: { id: true, email: true, firstName: true, lastName: true }
      });

      await sendSuggestionCreatedToAdmins({
        to,
        suggestion: {
          id: created.id,
          title,
          message,
          createdAt: created.createdAt,
          owner,
        },
        detailPath: `/admin/suggestions/${created.id}`,
      }).catch((err) => {
        console.warn("MAIL suggestion notify failed:", err?.message);
      });
    }

    res.json({ ok: true, id: created.id });
  } catch (e) {
    console.error("POST /feedback/suggestions", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/* ========== CUSTOMER: önerilerim ========== */
router.get("/suggestions/me", auth, roleCheck(["customer"]), async (_req, res) => {
  try {
    const rows = await prisma.suggestion.findMany({
      where: { ownerId: _req.user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, createdAt: true },
    });
    res.json(rows);
  } catch (e) {
    console.error("GET /feedback/suggestions/me", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});
/* ========== ADMIN: öneri listesi (sadece admin) ========== */
router.get("/admin/suggestions", auth, roleCheck(["admin"]), async (req, res) => {
  try {
    // Opsiyonel "seen" filtresi (Suggestion şemasında adminSeenAt varsa çalışır)
    const seen = String(req.query.seen || "").toLowerCase();
    const where = {};
    if (seen === "true")  where.adminSeenAt = { not: null };
    if (seen === "false") where.adminSeenAt = null;

    // 1) Önerileri çek (owner ile)
    const suggestions = await prisma.suggestion.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
    if (!suggestions.length) return res.json([]);

    // 2) Owner → AccessGrant’ler
    const ownerIds = Array.from(new Set(suggestions.map(s => s.ownerId)));
    const grants = await prisma.accessGrant.findMany({
      where: { ownerId: { in: ownerIds } },
      select: { ownerId: true, scopeType: true, customerId: true, storeId: true },
    });

    // 3) Owner’ların STORE grant’larından storeId set’i
    const storeIdSet = new Set(
      grants.filter(g => g.scopeType === "STORE" && g.storeId).map(g => g.storeId)
    );
    const storeIds = Array.from(storeIdSet);

    // 4) Önce store’ları çek (name/code/customerId için)
    const stores = storeIds.length
      ? await prisma.store.findMany({
          where: { id: { in: storeIds } },
          select: { id: true, name: true, code: true, customerId: true },
        })
      : [];
    const storeMap = Object.fromEntries(stores.map(s => [s.id, s]));

    // 5) Customer id set’i (CUSTOMER grant + store’lardan gelen customerId’ler)
    const customerIdSet = new Set(
      grants.filter(g => g.scopeType === "CUSTOMER" && g.customerId).map(g => g.customerId)
    );
    for (const s of stores) if (s.customerId) customerIdSet.add(s.customerId);
    const customerIds = Array.from(customerIdSet);

    // 6) Customer’ları çek (NOT: name yok; title var)
    const customers = customerIds.length
      ? await prisma.customer.findMany({
          where: { id: { in: customerIds } },
          select: { id: true, title: true }, // <-- name KALDIRILDI
        })
      : [];
    const customerMap = Object.fromEntries(customers.map(c => [c.id, c]));

    // 7) Owner başına müşteri başlığı ve (tekil ise) mağaza belirle
    const ownerCtx = new Map(); // ownerId -> { ownerCustomerTitle, store }
    for (const oid of ownerIds) {
      const og = grants.filter(g => g.ownerId === oid);

      // Öncelik: CUSTOMER scope
      const customerFromGrant = og.find(g => g.scopeType === "CUSTOMER" && g.customerId)?.customerId || null;

      // Owner’ın STORE grant’ları
      const ownerStoreIds = og.filter(g => g.scopeType === "STORE" && g.storeId).map(g => g.storeId);

      // CustomerId seçimi
      const customerId =
        customerFromGrant ||
        (ownerStoreIds.length ? (storeMap[ownerStoreIds[0]]?.customerId || null) : null);

      const customerRec = customerId ? customerMap[customerId] : null;
      const ownerCustomerTitle = customerRec?.title || null;

      // Birden fazla mağaza varsa belirsiz → null
      let storeShort = null;
      if (ownerStoreIds.length === 1) {
        const st = storeMap[ownerStoreIds[0]];
        if (st) storeShort = { id: st.id, name: st.name, code: st.code };
      }

      ownerCtx.set(oid, { ownerCustomerTitle, store: storeShort });
    }

    // 8) FE’nin beklediği alan adlarıyla normalize et
    const out = suggestions.map(s => {
      const ctx = ownerCtx.get(s.ownerId) || {};
      return {
        id: s.id,
        title: s.title,
        text: s.message,             // FE 'text' bekliyor
        createdAt: s.createdAt,
        isSeen: Boolean(s.adminSeenAt), // varsa çalışır
        owner: s.owner,
        ownerCustomerTitle: ctx.ownerCustomerTitle || null,
        store: ctx.store || null,    // {id, name, code} | null
      };
    });

    res.json(out);
  } catch (e) {
    console.error("GET /feedback/admin/suggestions", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});



/* ========== ADMIN: öneri detay (sadece admin) ========== */
router.get("/admin/suggestions/:id", auth, roleCheck(["admin"]), async (req, res) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ message: "Geçersiz id" });

    const row = await prisma.suggestion.findUnique({
      where: { id },
      include: { owner: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });
    if (!row) return res.status(404).json({ message: "Kayıt bulunamadı" });
    res.json(row);
  } catch (e) {
    console.error("GET /feedback/admin/suggestions/:id", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

export default router;
