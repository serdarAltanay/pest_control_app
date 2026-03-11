import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { PrismaClient } from "@prisma/client";
import { auth, roleCheck } from "../middleware/auth.js";

const prisma = new PrismaClient();
const router = express.Router();

const UPLOAD_ROOT = path.join(process.cwd(), "uploads", "certificates");
if (!fs.existsSync(UPLOAD_ROOT)) {
    fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

const rel = (abs) =>
    path.relative(process.cwd(), abs).split(path.sep).join("/");

const absFromRel = (p) =>
    path.resolve(process.cwd(), String(p || "").replace(/^\/+/, "").replace(/\\/g, "/"));

const ACCEPT = new Set([
    "application/pdf",
    "image/png", "image/jpeg", "image/jpg", "image/webp",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const fileFilter = (_req, file, cb) => {
    if (!ACCEPT.has(file.mimetype)) return cb(new Error("Dosya türüne izin verilmiyor"));
    cb(null, true);
};

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_ROOT),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname) || "";
        cb(null, `cert-${Date.now()}${ext}`);
    },
});

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

/* ===== LIST: GET /api/certificates ===== */
router.get("/", auth, async (req, res) => {
    try {
        const items = await prisma.companyCertificate.findMany({
            orderBy: { uploadedAt: "desc" },
        });
        res.json(items);
    } catch (e) {
        console.error("GET /certificates error:", e);
        res.status(500).json({ error: "Sertifikalar alınamadı" });
    }
});

/* ===== CREATE: POST /api/certificates ===== (Sadece Admin) */
router.post("/", auth, roleCheck(["admin"]), upload.single("file"), async (req, res) => {
    try {
        const { title, notes, uploadedAt } = req.body;
        if (!title) return res.status(400).json({ error: "Başlık zorunlu" });
        if (!req.file) return res.status(400).json({ error: "Dosya zorunlu" });

        const filePath = rel(req.file.path);
        const mime = req.file.mimetype || null;

        const created = await prisma.companyCertificate.create({
            data: {
                title,
                file: filePath,
                mime,
                notes: notes ?? null,
                uploadedAt: uploadedAt ? new Date(uploadedAt) : new Date(),
            },
        });

        res.status(201).json(created);
    } catch (e) {
        console.error("POST /certificates error:", e);
        res.status(500).json({ error: "Sertifika kaydedilemedi" });
    }
});

/* ===== DOWNLOAD: GET /api/certificates/:id/download ===== */
router.get("/:id/download", auth, async (req, res) => {
    try {
        const id = Number(req.params.id);
        const item = await prisma.companyCertificate.findUnique({ where: { id } });
        if (!item) return res.status(404).json({ error: "Kayıt bulunamadı" });

        const abs = absFromRel(item.file);
        console.log(`[DEBUG] Company download: resolving ${item.file} to ${abs}`);
        if (!fs.existsSync(abs)) {
            console.error(`[ERROR] File not found at: ${abs}`);
            return res.status(404).json({ error: "Dosya yok: " + item.file });
        }

        res.download(abs, path.basename(abs));
    } catch (e) {
        console.error("GET /certificates/:id/download error:", e);
        res.status(500).json({ error: "Sertifika indirilemedi" });
    }
});

/* ===== VIEW: GET /api/certificates/:id/view ===== */
router.get("/:id/view", auth, async (req, res) => {
    try {
        const id = Number(req.params.id);
        const item = await prisma.companyCertificate.findUnique({ where: { id } });
        if (!item) return res.status(404).json({ error: "Kayıt bulunamadı" });

        const abs = absFromRel(item.file);
        console.log(`[DEBUG] Company view: resolving ${item.file} to ${abs}`);
        if (!fs.existsSync(abs)) {
            console.error(`[ERROR] File not found at: ${abs}`);
            return res.status(404).json({ error: "Dosya yok: " + item.file });
        }

        if (item.mime) {
            res.setHeader("Content-Type", item.mime);
        } else if (abs.toLowerCase().endsWith(".pdf")) {
            res.setHeader("Content-Type", "application/pdf");
        }

        res.setHeader("Content-Disposition", "inline");
        // Stream the file directly
        const stream = fs.createReadStream(abs);
        stream.pipe(res);
    } catch (e) {
        console.error("GET /certificates/:id/view error:", e);
        res.status(500).json({ error: "Sertifika görüntülenemedi" });
    }
});

/* ===== DELETE: DELETE /api/certificates/:id ===== (Sadece Admin) */
router.delete("/:id", auth, roleCheck(["admin"]), async (req, res) => {
    try {
        const id = Number(req.params.id);
        const item = await prisma.companyCertificate.findUnique({ where: { id } });
        if (!item) return res.status(404).json({ error: "Kayıt bulunamadı" });

        const abs = absFromRel(item.file);
        try { if (fs.existsSync(abs)) fs.unlinkSync(abs); } catch { }

        await prisma.companyCertificate.delete({ where: { id } });
        res.json({ ok: true });
    } catch (e) {
        console.error("DELETE /certificates/:id error:", e);
        res.status(500).json({ error: "Sertifika silinemedi" });
    }
});

export default router;
