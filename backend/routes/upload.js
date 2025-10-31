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

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, AVATAR_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const role = req.user?.role || "user";
    const id   = req.user?.id   || "x";
    cb(null, `${role}-${id}-${Date.now()}${ext}`);
  },
});
const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

function removeIfExists(relOrAbsPath) {
  if (!relOrAbsPath) return;
  const abs = path.isAbsolute(relOrAbsPath) ? relOrAbsPath : absFromRel(relOrAbsPath);
  try { if (fs.existsSync(abs)) fs.unlinkSync(abs); }
  catch (e) { console.warn("Avatar silinemedi:", e?.message); }
}

// Avatar kullanımına izin verilen roller
const AVATAR_ROLES = new Set(["admin", "employee"]);

async function getTargetUser(prismaClient, role, id) {
  if (role === "admin")    return prismaClient.admin.findUnique({ where: { id } });
  if (role === "employee") return prismaClient.employee.findUnique({ where: { id } });
  // AccessOwner (customer) için avatar kapalı
  return null;
}
async function updateTargetUser(prismaClient, role, id, data) {
  if (role === "admin")    return prismaClient.admin.update({ where: { id }, data });
  if (role === "employee") return prismaClient.employee.update({ where: { id }, data });
  throw new Error("Geçersiz ya da izin verilmeyen rol");
}

/* ------------- POST /api/upload/avatar ------------- */
router.post("/avatar", auth, upload.single("avatar"), async (req, res) => {
  try {
    const { id, role } = req.user || {};
    if (!AVATAR_ROLES.has(role)) {
      // AccessOwner (customer) için avatar yükleme devre dışı
      if (req.file?.path) removeIfExists(req.file.path); // yüklenmişse geri sil
      return res.status(403).json({ error: "Bu rol için avatar özelliği devre dışı" });
    }

    if (!req.file) return res.status(400).json({ error: "Dosya yüklenmedi" });

    const current = await getTargetUser(prisma, role, id);
    if (!current) {
      // güvenlik: kaydı yoksa dosyayı sil
      removeIfExists(req.file.path);
      return res.status(404).json({ error: "Kullanıcı bulunamadı" });
    }

    // eski resmi sil
    removeIfExists(current.profileImage);

    // DB'ye hep forward slash ile kaydet
    const relativePath = rel(req.file.path); // "uploads/avatars/....jpg"
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

    // dosyayı sil
    removeIfExists(target.profileImage);

    // DB'de null yap
    await updateTargetUser(prisma, targetRole, targetId, { profileImage: null });

    res.json({ message: "Avatar kaldırıldı", id: targetId, role: targetRole });
  } catch (err) {
    console.error("DELETE /upload/avatar error:", err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;
