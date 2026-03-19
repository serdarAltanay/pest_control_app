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

const storage = multer.memoryStorage();

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

/* ===== LIST: GET /api/certificates ===== */
router.get("/", auth, async (req, res) => {
    if (req.user.role === "employee") {
        return res.status(403).json({ error: "Bu işlem için yetkiniz yok." });
    }
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

        const mime = req.file.mimetype || null;
        
        const fileRow = await prisma.fileStorage.create({
            data: {
                filename: req.file.originalname,
                mime: mime || "application/octet-stream",
                data: req.file.buffer
            }
        });

        const created = await prisma.companyCertificate.create({
            data: {
                title,
                file: `api/files/${fileRow.id}`,
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
    if (req.user.role === "employee") {
        return res.status(403).json({ error: "Bu işlem için yetkiniz yok." });
    }
    try {
        const id = Number(req.params.id);
        const item = await prisma.companyCertificate.findUnique({ where: { id } });
        if (!item) return res.status(404).json({ error: "Kayıt bulunamadı" });

        if (item.file.startsWith("api/files/")) {
            const fileId = item.file.split("api/files/")[1];
            const fileRow = await prisma.fileStorage.findUnique({ where: { id: fileId } });
            if (!fileRow) return res.status(404).json({ error: "Sunucuda dosya bulunamadı" });
            
            res.setHeader("Content-Type", fileRow.mime);
            res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fileRow.filename)}"`);
            return res.send(fileRow.data);
        }

        let abs = absFromRel(item.file);
        console.log(`[DEBUG] Company download: item.file=${item.file} -> abs=${abs}`);
        
        if (!fs.existsSync(abs)) {
            // Yedek plan: Eğer resolve edilen yol yoksa, doğrudan relative deniyoruz
            const altPath = path.join(process.cwd(), item.file);
            console.log(`[DEBUG] Company download alt check: ${altPath}`);
            if (fs.existsSync(altPath)) {
                abs = altPath;
            } else {
                console.error(`[ERROR] File not found at: ${abs} AND ${altPath}`);
                return res.status(404).json({ error: "Sunucuda dosya bulunamadı: " + item.file });
            }
        }

        res.download(abs, path.basename(abs));
    } catch (e) {
        console.error("GET /certificates/:id/download error:", e);
        res.status(500).json({ error: "Sertifika indirilemedi" });
    }
});

/* ===== VIEW: GET /api/certificates/:id/view ===== */
router.get("/:id/view", auth, async (req, res) => {
    if (req.user.role === "employee") {
        return res.status(403).json({ error: "Bu işlem için yetkiniz yok." });
    }
    try {
        const id = Number(req.params.id);
        const item = await prisma.companyCertificate.findUnique({ where: { id } });
        if (!item) return res.status(404).json({ error: "Kayıt bulunamadı" });

        if (item.file.startsWith("api/files/")) {
            const fileId = item.file.split("api/files/")[1];
            const fileRow = await prisma.fileStorage.findUnique({ where: { id: fileId } });
            if (!fileRow) return res.status(404).json({ error: "Sunucuda dosya bulunamadı" });
            
            res.setHeader("Content-Type", fileRow.mime);
            res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(fileRow.filename)}"`);
            return res.send(fileRow.data);
        }

        let abs = absFromRel(item.file);
        console.log(`[DEBUG] Company view: item.file=${item.file} -> abs=${abs}`);
        if (!fs.existsSync(abs)) {
            const altPath = path.join(process.cwd(), item.file);
            console.log(`[DEBUG] Company view alt check: ${altPath}`);
            if (fs.existsSync(altPath)) {
                abs = altPath;
            } else {
                console.error(`[ERROR] File not found at: ${abs} AND ${altPath}`);
                return res.status(404).json({ error: "Sunucuda dosya bulunamadı: " + item.file });
            }
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

        if (item.file.startsWith("api/files/")) {
            const fileId = item.file.split("api/files/")[1];
            await prisma.fileStorage.delete({ where: { id: fileId } }).catch(() => {});
        } else {
            const abs = absFromRel(item.file);
            try { if (fs.existsSync(abs)) fs.unlinkSync(abs); } catch { }
        }

        await prisma.companyCertificate.delete({ where: { id } });
        res.json({ ok: true });
    } catch (e) {
        console.error("DELETE /certificates/:id error:", e);
        res.status(500).json({ error: "Sertifika silinemedi" });
    }
});

export default router;
