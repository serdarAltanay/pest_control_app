import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { auth, roleCheck } from "../middleware/auth.js";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();
const prisma = new PrismaClient();

// Multer Config
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dest = path.join(process.cwd(), "uploads", "certificates");
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        cb(null, dest);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, `biocide-cert-${uniqueSuffix}${ext}`);
    },
});

const fileFilter = (req, file, cb) => {
    const allowedMimes = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Desteklenmeyen dosya formatı. Sadece PDF, JPG veya PNG yükleyebilirsiniz."));
    }
};

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
    fileFilter,
});

/**
 * 1) Biyosidal Sertifikalarını Listele (Herkes)
 * Admin, Çalışan ve Müşteri görebilir.
 */
router.get("/", auth, async (req, res) => {
    try {
        const certs = await prisma.biocideCertificate.findMany({
            include: {
                biocide: {
                    select: {
                        name: true,
                    },
                },
            },
            orderBy: { uploadedAt: "desc" },
        });
        res.json(certs);
    } catch (e) {
        console.error("GET /biocidal-certificates error:", e);
        res.status(500).json({ message: "Sunucu hatası" });
    }
});

/**
 * 2) Yeni Biyosidal Sertifikası Yükle (Admin & Çalışan)
 */
router.post(
    "/",
    auth,
    roleCheck(["admin", "employee"]),
    upload.single("file"),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ message: "Dosya gerekli." });
            }

            const { title, biocideId, notes } = req.body;
            if (!title) {
                fs.unlinkSync(req.file.path);
                return res.status(400).json({ message: "Sertifika başlığı (title) gerekli." });
            }
            if (!biocideId) {
                fs.unlinkSync(req.file.path);
                return res.status(400).json({ message: "Hangi Biyosidal'e ait olduğu (biocideId) gerekli." });
            }

            // Biyosidalin varlığını kontrol et
            const biocideExists = await prisma.biocide.findUnique({
                where: { id: parseInt(biocideId, 10) },
            });

            if (!biocideExists) {
                fs.unlinkSync(req.file.path);
                return res.status(404).json({ message: "Belirtilen Biyosidal bulunamadı." });
            }

            const relativePath = path.join("uploads", "certificates", req.file.filename).replace(/\\/g, "/");

            const cert = await prisma.biocideCertificate.create({
                data: {
                    title,
                    biocideId: parseInt(biocideId, 10),
                    file: relativePath,
                    mime: req.file.mimetype,
                    notes: notes || null,
                },
                include: {
                    biocide: { select: { name: true } },
                },
            });

            res.status(201).json(cert);
        } catch (e) {
            console.error("POST /biocidal-certificates error:", e);
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            res.status(500).json({ message: e.message || "Sunucu hatası" });
        }
    }
);

/**
 * 3) Biyosidal Sertifikası Sil (Admin & Çalışan)
 */
router.delete("/:id", auth, roleCheck(["admin", "employee"]), async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ message: "Geçersiz ID" });

        const cert = await prisma.biocideCertificate.findUnique({ where: { id } });
        if (!cert) return res.status(404).json({ message: "Sertifika bulunamadı." });

        // Fiziksel dosyayı sil
        const fullPath = path.join(process.cwd(), cert.file);
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }

        await prisma.biocideCertificate.delete({ where: { id } });

        res.json({ message: "Sertifika başarıyla silindi." });
    } catch (e) {
        console.error("DELETE /biocidal-certificates/:id error:", e);
        res.status(500).json({ message: "Sunucu hatası" });
    }
});

/**
 * 4) Biyosidal Sertifikası İndir (Herkes)
 */
router.get("/:id/download", auth, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ message: "Geçersiz ID" });

        const cert = await prisma.biocideCertificate.findUnique({ where: { id } });
        if (!cert) return res.status(404).json({ message: "Sertifika bulunamadı." });

        const fullPath = path.resolve(process.cwd(), cert.file);
        if (!fs.existsSync(fullPath)) return res.status(404).json({ message: "Dosya sunucuda bulunamadı." });

        res.download(fullPath, path.basename(fullPath));
    } catch (e) {
        console.error("GET /biocidal-certificates/:id/download error:", e);
        res.status(500).json({ message: "Sunucu hatası" });
    }
});

/**
 * 5) Biyosidal Sertifikası Görüntüle (Herkes)
 */
router.get("/:id/view", auth, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ message: "Geçersiz ID" });

        const cert = await prisma.biocideCertificate.findUnique({ where: { id } });
        if (!cert) return res.status(404).json({ message: "Sertifika bulunamadı." });

        const fullPath = path.resolve(process.cwd(), cert.file);
        if (!fs.existsSync(fullPath)) return res.status(404).json({ message: "Dosya sunucuda bulunamadı." });

        if (cert.mime) {
            res.setHeader("Content-Type", cert.mime);
        } else if (fullPath.toLowerCase().endsWith(".pdf")) {
            res.setHeader("Content-Type", "application/pdf");
        }

        res.setHeader("Content-Disposition", "inline");
        const stream = fs.createReadStream(fullPath);
        stream.pipe(res);
    } catch (e) {
        console.error("GET /biocidal-certificates/:id/view error:", e);
        res.status(500).json({ message: "Sunucu hatası" });
    }
});

export default router;
