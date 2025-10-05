// backend/routes/wipe.js
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { auth, roleCheck } from "../middleware/auth.js";
import fs from "fs";
import path from "path";

const router = Router();
const prisma = new PrismaClient();

/** Güvenli dosya silici (sessiz hata) */
function safeUnlink(filePath) {
  try {
    if (!filePath) return false;
    // Göreli path'leri proje köküne göre normalize et
    const absolute = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);
    if (fs.existsSync(absolute)) {
      fs.unlinkSync(absolute);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Bir tablo için: kayıtları çek -> her birini tek tek:
 *  - profil görselini sil (varsa)
 *  - veritabanında delete
 * Sonunda kaç kayıt silindi ve kaç dosya silindi döner.
 */
async function wipeTableIndividually({ table, select, hasProfileImage }) {
  // 1) Kayıtları çek
  const items = await prisma[table].findMany({ select });

  let deletedCount = 0;
  let removedFiles = 0;

  // 2) Her kayıt için sırayla sil
  for (const it of items) {
    try {
      // a) Dosya sil
      if (hasProfileImage && it.profileImage) {
        const ok = safeUnlink(it.profileImage);
        if (ok) removedFiles += 1;
      }

      // b) DB delete
      await prisma[table].delete({ where: { id: it.id } });
      deletedCount += 1;
    } catch (e) {
      // tekil bir silme patlarsa diğerlerine devam et
      // istersen console.error bırakabilirsin
      // console.error(`delete ${table}#${it.id} error:`, e);
    }
  }

  return { deletedCount, removedFiles };
}

router.post("/", auth, roleCheck(["admin"]), async (_req, res) => {
  try {
    // RefreshToken'ları toptan silebiliriz
    let refreshTokensDeleted = 0;
    try {
      const rt = await prisma.refreshToken?.deleteMany({});
      refreshTokensDeleted = rt?.count ?? 0;
    } catch {
      refreshTokensDeleted = 0;
    }

    // Sıra hassasiyeti olabilecek ilişkiler için (ör: müşteri -> employee -> admin)
    // önce müşterileri, sonra personelleri, sonra adminleri silmek genelde güvenli olur.
    const customersResult = await wipeTableIndividually({
      table: "customer",
      select: { id: true, profileImage: true }, // profil görseli sütunu varsa
      hasProfileImage: true,
    });

    const employeesResult = await wipeTableIndividually({
      table: "employee",
      select: { id: true, profileImage: true },
      hasProfileImage: true,
    });

    const adminsResult = await wipeTableIndividually({
      table: "admin",
      select: { id: true, profileImage: true },
      hasProfileImage: true,
    });

    return res.json({
      message: "Tüm veriler başarıyla silindi!",
      stats: {
        refreshTokens: refreshTokensDeleted,
        customers: customersResult.deletedCount,
        customersProfileImagesRemoved: customersResult.removedFiles,
        employees: employeesResult.deletedCount,
        employeesProfileImagesRemoved: employeesResult.removedFiles,
        admins: adminsResult.deletedCount,
        adminsProfileImagesRemoved: adminsResult.removedFiles,
      },
    });
  } catch (err) {
    console.error("WIPE error:", err);
    return res.status(500).json({ error: "Silme işlemi başarısız" });
  }
});

export default router;
