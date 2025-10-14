// backend/routes/nonconformities.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { PrismaClient } from "@prisma/client";
import { auth } from "../middleware/auth.js";

const prisma = new PrismaClient();
const router = express.Router();

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");
const NCR_ROOT    = path.join(UPLOAD_ROOT, "nonconformities");
if (!fs.existsSync(NCR_ROOT)) fs.mkdirSync(NCR_ROOT, { recursive: true });

const onlyImages = (_req, file, cb) => {
  const ok = ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.mimetype);
  if (!ok) return cb(new Error("Sadece png/jpg/jpeg/webp yükleyebilirsiniz"));
  cb(null, true);
};

const slugify = (s = "") =>
  s.toLowerCase()
   .replace(/[^\p{L}\p{N}]+/gu, "-")
   .replace(/-+/g, "-")
   .replace(/^-|-$/g, "");

async function ensureStoreFolder(storeId) {
  const store = await prisma.store.findUnique({ where: { id: Number(storeId) } });
  const folder = path.join(NCR_ROOT, `${slugify(store?.name || `store-${storeId}`)}-${storeId}`);
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
  return folder;
}
const rel = (abs) => path.relative(process.cwd(), abs).replace(/\\/g, "/");

const storage = multer.diskStorage({
  destination: async (req, _file, cb) => {
    try { cb(null, await ensureStoreFolder(req.params.storeId)); }
    catch (e) { cb(e); }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `ncr-${Date.now()}${ext}`);
  },
});
const upload = multer({ storage, fileFilter: onlyImages, limits: { fileSize: 8 * 1024 * 1024 } });

/* ===== GET /nonconformities/:id (DETAY) — ÖNE ALINDI ===== */
router.get("/:id", auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: `Geçersiz id: ${req.params.id}` });
    }
    const item = await prisma.nonconformity.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ error: `Kayıt bulunamadı (id=${id})` });
    res.json(item);
  } catch (e) {
    console.error("GET /nonconformities/:id error:", e);
    res.status(500).json({ error: `Kayıt getirilemedi: ${e?.message || "bilinmeyen hata"}` });
  }
});

/* ===== CREATE ===== */
router.post("/store/:storeId", auth, upload.single("image"), async (req, res) => {
  try {
    const storeId = Number(req.params.storeId);
    if (!Number.isInteger(storeId) || storeId <= 0) {
      return res.status(400).json({ error: `Geçersiz mağaza id: ${req.params.storeId}` });
    }

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, name: true },
    });
    if (!store) {
      return res.status(404).json({ error: `Mağaza bulunamadı (storeId=${storeId})` });
    }

    const { category, title, notes, observedAt } = req.body;
    if (!category) return res.status(400).json({ error: "Kategori zorunlu" });

    const fileRel = req.file ? rel(req.file.path) : null;

    const created = await prisma.nonconformity.create({
      data: {
        storeId,
        category,
        title: title ?? "",                 // boş string de kabul
        notes: notes ?? null,
        image: fileRel,
        observedAt: observedAt ? new Date(observedAt) : new Date(),
        createdById:   req.user?.id || null,
        createdByRole: req.user?.role || null,
        createdByName: req.user?.name || null,
      },
    });

    res.json(created);
  } catch (e) {
    console.error("POST /nonconformities/store/:storeId error:", e);
    res.status(500).json({ error: `Kaydedilemedi: ${e?.message || "bilinmeyen hata"}` });
  }
});

/* ===== LIST ===== */
router.get("/store/:storeId", auth, async (req, res) => {
  try {
    const storeId = Number(req.params.storeId);
    if (!Number.isInteger(storeId) || storeId <= 0) {
      return res.status(400).json({ error: `Geçersiz mağaza id: ${req.params.storeId}` });
    }
    const items = await prisma.nonconformity.findMany({
      where: { storeId },
      orderBy: [{ observedAt: "desc" }, { createdAt: "desc" }],
    });
    res.json(items);
  } catch (e) {
    console.error("GET /nonconformities/store/:storeId error:", e);
    res.status(500).json({ error: `Liste alınamadı: ${e?.message || "bilinmeyen hata"}` });
  }
});

/* ===== TOGGLE ===== */
router.patch("/:id/toggle", auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const current = await prisma.nonconformity.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ error: `Kayıt bulunamadı (id=${id})` });

    const next = !current.resolved;
    const updated = await prisma.nonconformity.update({
      where: { id },
      data: { resolved: next, resolvedAt: next ? new Date() : null },
    });
    res.json(updated);
  } catch (e) {
    console.error("PATCH /nonconformities/:id/toggle error:", e);
    res.status(500).json({ error: `Güncellenemedi: ${e?.message || "bilinmeyen hata"}` });
  }
});

/* ===== DELETE ===== */
router.delete("/:id", auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const item = await prisma.nonconformity.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ error: `Kayıt bulunamadı (id=${id})` });

    if (item.image) {
      const abs = path.join(process.cwd(), item.image);
      try { if (fs.existsSync(abs)) fs.unlinkSync(abs); } catch {}
    }
    await prisma.nonconformity.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /nonconformities/:id error:", e);
    res.status(500).json({ error: `Silinemedi: ${e?.message || "bilinmeyen hata"}` });
  }
});

export default router;
