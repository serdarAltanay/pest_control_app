import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { auth, roleCheck } from "../middleware/auth.js";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();
const prisma = new PrismaClient();

// Multer Config
const storage = multer.memoryStorage();

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
        if (req.user.role === "employee" && req.user.level === 2) {
            return res.status(403).json({ message: "Bu işlem için yetkiniz yok." });
        }
        try {
            if (!req.file) {
                return res.status(400).json({ message: "Dosya gerekli." });
            }

            const { title, biocideId, notes } = req.body;
            if (!title) {
                return res.status(400).json({ message: "Sertifika başlığı (title) gerekli." });
            }
            if (!biocideId) {
                return res.status(400).json({ message: "Hangi Biyosidal'e ait olduğu (biocideId) gerekli." });
            }

            // Biyosidalin varlığını kontrol et
            const biocideExists = await prisma.biocide.findUnique({
                where: { id: parseInt(biocideId, 10) },
            });

            if (!biocideExists) {
                return res.status(404).json({ message: "Belirtilen Biyosidal bulunamadı." });
            }

            const mime = req.file.mimetype || null;
            
            const fileRow = await prisma.fileStorage.create({
                data: {
                    filename: req.file.originalname,
                    mime: mime || "application/octet-stream",
                    data: req.file.buffer
                }
            });

            const cert = await prisma.biocideCertificate.create({
                data: {
                    title,
                    biocideId: parseInt(biocideId, 10),
                    file: `api/files/${fileRow.id}`,
                    mime,
                    notes: notes || null,
                },
                include: {
                    biocide: { select: { name: true } },
                },
            });

            res.status(201).json(cert);
        } catch (e) {
            console.error("POST /biocidal-certificates error:", e);
            res.status(500).json({ message: e.message || "Sunucu hatası" });
        }
    }
);

/**
 * 3) Biyosidal Sertifikası Sil (Admin & Çalışan)
 */
router.delete("/:id", auth, roleCheck(["admin", "employee"]), async (req, res) => {
    if (req.user.role === "employee" && req.user.level === 2) {
        return res.status(403).json({ message: "Bu işlem için yetkiniz yok." });
    }
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ message: "Geçersiz ID" });

        const cert = await prisma.biocideCertificate.findUnique({ where: { id } });
        if (!cert) return res.status(404).json({ message: "Sertifika bulunamadı." });

        if (cert.file.startsWith("api/files/")) {
            const fileId = cert.file.split("api/files/")[1];
            await prisma.fileStorage.delete({ where: { id: fileId } }).catch(() => {});
        } else {
            // Fiziksel dosyayı sil
            const fullPath = path.join(process.cwd(), cert.file);
            if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
            }
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

        if (cert.file.startsWith("api/files/")) {
            const fileId = cert.file.split("api/files/")[1];
            const fileRow = await prisma.fileStorage.findUnique({ where: { id: fileId } });
            if (!fileRow) return res.status(404).json({ message: "Sunucuda dosya bulunamadı" });
            
            res.setHeader("Content-Type", fileRow.mime);
            res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fileRow.filename)}"`);
            return res.send(fileRow.data);
        }

        let fullPath = path.resolve(process.cwd(), cert.file);
        console.log(`[DEBUG] Biocidal download: item.file=${cert.file} -> abs=${fullPath}`);
        if (!fs.existsSync(fullPath)) {
            const altPath = path.join(process.cwd(), cert.file);
            console.log(`[DEBUG] Biocidal download alt check: ${altPath}`);
            if (fs.existsSync(altPath)) {
                fullPath = altPath;
            } else {
                console.error(`[ERROR] File not found at: ${fullPath} AND ${altPath}`);
                return res.status(404).json({ message: "Sunucuda dosya bulunamadı: " + cert.file });
            }
        }

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

        if (cert.file.startsWith("api/files/")) {
            const fileId = cert.file.split("api/files/")[1];
            const fileRow = await prisma.fileStorage.findUnique({ where: { id: fileId } });
            if (!fileRow) return res.status(404).json({ message: "Sunucuda dosya bulunamadı" });
            
            res.setHeader("Content-Type", fileRow.mime);
            res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(fileRow.filename)}"`);
            return res.send(fileRow.data);
        }

        let fullPath = path.resolve(process.cwd(), cert.file);
        console.log(`[DEBUG] Biocidal view: item.file=${cert.file} -> abs=${fullPath}`);
        if (!fs.existsSync(fullPath)) {
            const altPath = path.join(process.cwd(), cert.file);
            console.log(`[DEBUG] Biocidal view alt check: ${altPath}`);
            if (fs.existsSync(altPath)) {
                fullPath = altPath;
            } else {
                console.error(`[ERROR] File not found at: ${fullPath} AND ${altPath}`);
                return res.status(404).json({ message: "Sunucuda dosya bulunamadı: " + cert.file });
            }
        }

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
