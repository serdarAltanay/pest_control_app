import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { PrismaClient } from "@prisma/client";
import { auth } from "../middleware/auth.js";

const prisma = new PrismaClient();
const router = express.Router();

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

// DB'ye yazarken: absolute → relative (ve forward slash)
const rel = (abs) =>
  path.relative(process.cwd(), abs).split(path.sep).join("/");

// DB'den okurken: relative → absolute (Windows/mac uyumlu)
const absFromRel = (p) =>
  path.resolve(process.cwd(), String(p || "").replace(/^\/+/, "").replace(/\\/g, "/"));

// desteklenen içerik tipleri
const ACCEPT = new Set([
  "application/pdf",
  "image/png", "image/jpeg", "image/jpg", "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
]);

const slugify = (s = "") =>
  s.toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

async function ensureStoreReportDir(storeId) {
  const sid = Number(storeId);
  const store = await prisma.store.findUnique({ where: { id: sid } });
  const storeFolder = path.join(UPLOAD_ROOT, `${slugify(store?.name || `store-${sid}`)}-${sid}`);
  const reportsDir  = path.join(storeFolder, "reports");
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  return reportsDir;
}

const fileFilter = (_req, file, cb) => {
  if (!ACCEPT.has(file.mimetype)) return cb(new Error("Dosya türüne izin verilmiyor"));
  cb(null, true);
};

const storage = multer.diskStorage({
  destination: async (req, _file, cb) => {
    try { cb(null, await ensureStoreReportDir(req.params.storeId)); }
    catch (e) { cb(e); }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || "";
    cb(null, `report-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

/* ===== CREATE: POST /reports/store/:storeId ===== */
router.post("/store/:storeId", auth, upload.single("file"), async (req, res) => {
  try {
    const storeId = Number(req.params.storeId);
    if (!Number.isInteger(storeId) || storeId <= 0) return res.status(400).json({ error: "Geçersiz mağaza id" });

    const store = await prisma.store.findUnique({ where: { id: storeId }, select: { id: true } });
    if (!store) return res.status(404).json({ error: "Mağaza bulunamadı" });

    const { title, notes, uploadedAt } = req.body;
    if (!title) return res.status(400).json({ error: "Başlık zorunlu" });
    if (!req.file) return res.status(400).json({ error: "Dosya zorunlu" });

    const filePath = rel(req.file.path);    // 🔧 always forward-slash
    const mime     = req.file.mimetype || null;

    const created = await prisma.report.create({
      data: {
        storeId,
        title,
        file: filePath,
        mime,
        notes: notes ?? null,
        uploadedAt: uploadedAt ? new Date(uploadedAt) : new Date(),
      },
    });

    res.json(created);
  } catch (e) {
    console.error("POST /reports/store/:storeId error:", e);
    res.status(500).json({ error: "Kaydedilemedi" });
  }
});

/* ===== LIST: GET /reports/store/:storeId ===== */
router.get("/store/:storeId", auth, async (req, res) => {
  try {
    const storeId = Number(req.params.storeId);
    if (!Number.isInteger(storeId) || storeId <= 0) return res.status(400).json({ error: "Geçersiz mağaza id" });

    const items = await prisma.report.findMany({
      where: { storeId },
      orderBy: [{ uploadedAt: "desc" }, { createdAt: "desc" }],
    });
    res.json(items);
  } catch (e) {
    console.error("GET /reports/store/:storeId error:", e);
    res.status(500).json({ error: "Liste alınamadı" });
  }
});

/* ===== DETAIL: GET /reports/:id ===== */
router.get("/:id", auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Geçersiz id" });

    const item = await prisma.report.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ error: "Kayıt bulunamadı" });

    res.json(item);
  } catch (e) {
    console.error("GET /reports/:id error:", e);
    res.status(500).json({ error: "Kayıt getirilemedi" });
  }
});

/* ===== DOWNLOAD: GET /reports/:id/download ===== */
router.get("/:id/download", auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const item = await prisma.report.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ error: "Kayıt bulunamadı" });

    const abs = absFromRel(item.file);
    if (!fs.existsSync(abs)) return res.status(404).json({ error: "Dosya yok" });

    res.download(abs, path.basename(abs));
  } catch (e) {
    console.error("GET /reports/:id/download error:", e);
    res.status(500).json({ error: "İndirilemedi" });
  }
});

/* ===== DELETE: DELETE /reports/:id ===== */
router.delete("/:id", auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const item = await prisma.report.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ error: "Kayıt bulunamadı" });

    const abs = absFromRel(item.file);
    try { if (fs.existsSync(abs)) fs.unlinkSync(abs); } catch {}

    await prisma.report.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /reports/:id error:", e);
    res.status(500).json({ error: "Silinemedi" });
  }
});

export default router;
