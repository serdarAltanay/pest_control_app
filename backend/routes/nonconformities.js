// routes/nonconformities.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { PrismaClient } from "@prisma/client";
import { auth, roleCheck } from "../middleware/auth.js";

const prisma = new PrismaClient();
const router = express.Router();

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

// path helpers
const rel = (abs) => path.relative(process.cwd(), abs).split(path.sep).join("/");
const absFromRel = (p) =>
  path.resolve(process.cwd(), String(p || "").replace(/^\/+/, "").replace(/\\/g, "/"));

const slugify = (s = "") =>
  s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

// access helpers (stores ile aynı mantık)
async function resolveOwnerId(req) {
  if (req.user?.ownerId) return Number(req.user.ownerId);
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
  if (["admin", "employee"].includes(req.user?.role)) return true;
  if (req.user?.role === "customer") {
    const ownerId = await resolveOwnerId(req);
    const ids = await collectAccessibleStoreIds(ownerId);
    return ids.includes(Number(storeId));
  }
  return false;
}

// upload/multer
async function ensureStoreNcrDir(storeId) {
  const sid = Number(storeId);
  const store = await prisma.store.findUnique({ where: { id: sid } });
  const storeFolder = path.join(UPLOAD_ROOT, `${slugify(store?.name || `store-${sid}`)}-${sid}`);
  const ncrDir = path.join(storeFolder, "nonconformities");
  if (!fs.existsSync(ncrDir)) fs.mkdirSync(ncrDir, { recursive: true });
  return ncrDir;
}

const onlyImages = (_req, file, cb) => {
  const ok = ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.mimetype);
  if (!ok) return cb(new Error("Sadece png/jpg/jpeg/webp yükleyebilirsiniz"));
  cb(null, true);
};

const storage = multer.diskStorage({
  destination: async (req, _file, cb) => {
    try {
      cb(null, await ensureStoreNcrDir(req.params.storeId));
    } catch (e) {
      cb(e);
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `ncr-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: onlyImages,
  limits: { fileSize: 8 * 1024 * 1024 },
});

/* ===== LIST ===== */
router.get("/store/:storeId", auth, async (req, res) => {
  try {
    const storeId = Number(req.params.storeId);
    if (!Number.isInteger(storeId) || storeId <= 0)
      return res.status(400).json({ error: "Geçersiz mağaza id" });

    if (!(await customerCanAccessStore(req, storeId))) {
      return res.status(403).json({ error: "Yetkisiz" });
    }

    const items = await prisma.nonconformity.findMany({
      where: { storeId },
      orderBy: [{ observedAt: "desc" }, { createdAt: "desc" }],
    });
    res.json(items);
  } catch (e) {
    console.error("GET /nonconformities/store/:storeId error:", e);
    res.status(500).json({ error: "Liste alınamadı" });
  }
});

/* ===== DETAIL ===== */
router.get("/:id", auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0)
      return res.status(400).json({ error: "Geçersiz id" });

    const item = await prisma.nonconformity.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ error: "Kayıt bulunamadı" });

    if (!(await customerCanAccessStore(req, item.storeId))) {
      return res.status(403).json({ error: "Yetkisiz" });
    }

    res.json(item);
  } catch (e) {
    console.error("GET /nonconformities/:id error:", e);
    res.status(500).json({ error: "Kayıt getirilemedi" });
  }
});

/* ===== CREATE (admin/employee) ===== */
router.post(
  "/store/:storeId",
  auth,
  roleCheck(["admin", "employee"]),
  upload.single("image"),
  async (req, res) => {
    try {
      const storeId = Number(req.params.storeId);
      if (!Number.isInteger(storeId) || storeId <= 0)
        return res.status(400).json({ error: "Geçersiz mağaza id" });

      const store = await prisma.store.findUnique({
        where: { id: storeId },
        select: { id: true },
      });
      if (!store) return res.status(404).json({ error: "Mağaza bulunamadı" });

      const { category, title, notes, observedAt } = req.body;
      if (!category) return res.status(400).json({ error: "Kategori zorunlu" });

      const fileRel = req.file ? rel(req.file.path) : null;

      const created = await prisma.nonconformity.create({
        data: {
          storeId,
          category,
          title: title ?? "",
          notes: notes ?? null,
          image: fileRel,
          observedAt: observedAt ? new Date(observedAt) : new Date(),
        },
      });
      res.json(created);
    } catch (e) {
      console.error("POST /nonconformities/store/:storeId error:", e);
      res.status(500).json({ error: "Kaydedilemedi" });
    }
  }
);

/* ===== TOGGLE (admin/employee) ===== */
router.patch("/:id/toggle", auth, roleCheck(["admin", "employee"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const current = await prisma.nonconformity.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ error: "Kayıt bulunamadı" });

    const next = !current.resolved;
    const updated = await prisma.nonconformity.update({
      where: { id },
      data: { resolved: next, resolvedAt: next ? new Date() : null },
    });
    res.json(updated);
  } catch (e) {
    console.error("PATCH /nonconformities/:id/toggle error:", e);
    res.status(500).json({ error: "Güncellenemedi" });
  }
});

/* ===== DELETE (admin/employee) ===== */
router.delete("/:id", auth, roleCheck(["admin", "employee"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const item = await prisma.nonconformity.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ error: "Kayıt bulunamadı" });

    if (item.image) {
      const abs = absFromRel(item.image);
      try {
        if (fs.existsSync(abs)) fs.unlinkSync(abs);
      } catch {}
    }
    await prisma.nonconformity.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /nonconformities/:id error:", e);
    res.status(500).json({ error: "Silinemedi" });
  }
});

export default router;
