// routes/upload.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { PrismaClient } from "@prisma/client";
import { auth } from "../middleware/auth.js";

const prisma = new PrismaClient();
const router = express.Router();

/* ---------------- Folders ---------------- */
const UPLOAD_ROOT = path.join(process.cwd(), "uploads");
const AVATAR_DIR  = path.join(UPLOAD_ROOT, "avatars");

// ensure folders
for (const dir of [UPLOAD_ROOT, AVATAR_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/* ---------------- Helpers ---------------- */
// DB'ye yazarken: absolute → relative (ve forward slash)
const rel = (abs) =>
  path.relative(process.cwd(), abs).split(path.sep).join("/");

// DB'den okurken: relative → absolute (Windows/mac uyumlu)
const absFromRel = (p) =>
  path.resolve(process.cwd(), String(p || "").replace(/^\/+/, "").replace(/\\/g, "/"));

const fileFilter = (_req, file, cb) => {
  const ok = ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.mimetype);
  cb(ok ? null : new Error("Geçersiz dosya türü (png/jpg/jpeg/webp)"), ok);
};

const storage = multer.memoryStorage();
const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// DB'deki FileStorage kaydını siler
async function removeFileFromDB(profileImagePath) {
    if (!profileImagePath || !profileImagePath.includes("api/files/")) return;
    const parts = profileImagePath.split("/");
    const id = parts[parts.length - 1]; // UUID
    if (id) {
        try {
            await prisma.fileStorage.delete({ where: { id } });
        } catch (e) {
            console.warn("DB file deletion error (avatar):", e.message);
        }
    }
}

// Avatar kullanımına izin verilen roller
const AVATAR_ROLES = new Set(["admin", "employee", "customer"]);

async function getTargetUser(prismaClient, role, id) {
  if (role === "admin")    return prismaClient.admin.findUnique({ where: { id } });
  if (role === "employee") return prismaClient.employee.findUnique({ where: { id } });
  if (role === "customer") return prismaClient.accessOwner.findUnique({ where: { id } });
  return null;
}
async function updateTargetUser(prismaClient, role, id, data) {
  if (role === "admin")    return prismaClient.admin.update({ where: { id }, data });
  if (role === "employee") return prismaClient.employee.update({ where: { id }, data });
  if (role === "customer") return prismaClient.accessOwner.update({ where: { id }, data });
  throw new Error("Geçersiz ya da izin verilmeyen rol");
}

/* ------------- POST /api/upload/avatar ------------- */
router.post("/avatar", auth, upload.single("avatar"), async (req, res) => {
  try {
    const { id, role } = req.user || {};
    if (!AVATAR_ROLES.has(role)) {
      return res.status(403).json({ error: "Bu rol için avatar özelliği devre dışı" });
    }

    if (!req.file) return res.status(400).json({ error: "Dosya yüklenmedi" });

    const current = await getTargetUser(prisma, role, id);
    if (!current) {
      return res.status(404).json({ error: "Kullanıcı bulunamadı" });
    }

    // 1) Eski resmi DB'den sil (eğer DB yolu ise)
    await removeFileFromDB(current.profileImage);

    // 2) Yeni resmi FileStorage'a kaydet
    const fileRecord = await prisma.fileStorage.create({
      data: {
        filename: req.file.originalname,
        mime: req.file.mimetype,
        data: req.file.buffer
      }
    });

    // 3) Kullanıcının profileImage alanını güncelle
    const relativePath = `api/files/${fileRecord.id}`;
    const updated = await updateTargetUser(prisma, role, id, { profileImage: relativePath });

    res.json({ message: "Avatar güncellendi", profileImage: updated.profileImage });
  } catch (err) {
    console.error("Upload hatası:", err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

/* ------------- DELETE /api/upload/avatar ------------- */
router.delete("/avatar", auth, async (req, res) => {
  try {
    let { role: targetRole, id: targetId } = req.body || {};
    if (targetId !== undefined) targetId = Number(targetId);

    // self default
    if (!targetRole || !targetId) {
      targetRole = req.user.role;
      targetId   = req.user.id;
    }

    // yetkilendirme: admin -> herkes; diğer roller -> sadece kendi
    const isSelf = req.user.role === targetRole && req.user.id === targetId;
    if (!isSelf && req.user.role !== "admin") {
      return res.status(403).json({ error: "Bu işlem için yetkiniz yok" });
    }

    // AccessOwner (customer) tarafında avatar özelliği kapalı
    if (!AVATAR_ROLES.has(targetRole)) {
      return res.status(403).json({ error: "Bu rol için avatar özelliği devre dışı" });
    }

    const target = await getTargetUser(prisma, targetRole, targetId);
    if (!target) return res.status(404).json({ error: "Kullanıcı bulunamadı" });

    // DB'deki dosyayı sil
    await removeFileFromDB(target.profileImage);

    // DB'de null yap
    await updateTargetUser(prisma, targetRole, targetId, { profileImage: null });

    res.json({ message: "Avatar kaldırıldı", id: targetId, role: targetRole });
  } catch (err) {
    console.error("DELETE /upload/avatar error:", err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;
