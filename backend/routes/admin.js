import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { auth, roleCheck } from "../middleware/auth.js";
import { createBackup } from "../lib/backup.js";
import { isEmailTaken } from "../lib/user-utils.js";

const router = Router();
const prisma = new PrismaClient();

/** Tüm adminler (liste) */
router.get("/admins", auth, roleCheck(["admin"]), async (_req, res) => {
  try {
    const admins = await prisma.admin.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fullName: true,
        email: true,
        profileImage: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        lastSeenAt: true, // <<< ÖNEMLİ
      },
    });
    res.json(admins);
  } catch (e) {
    console.error("GET /admin/admins", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/** Yedekleme sistemini test et (DB bağlantısı) */
router.get("/backup/test", auth, roleCheck(["admin"]), async (_req, res) => {
  try {
    const mysql = await import("mysql2/promise");
    const fs = await import("fs");
    const path = await import("path");
    const { fileURLToPath } = await import("url");

    // .env dosyasını bul
    const thisFile = fileURLToPath(import.meta.url);
    const thisDir = path.default.dirname(thisFile);
    const envPath = path.default.resolve(thisDir, "..", ".env");
    const envExists = fs.default.existsSync(envPath);

    // .env dosyasını yükle (dotenv.config backup.js'ten farklı çalışabilir)
    let envLoaded = false;
    if (envExists) {
      const dotenv = await import("dotenv");
      dotenv.config({ path: envPath });
      envLoaded = true;
    }

    // DATABASE_URL parse
    function parseDbUrl(url) {
      try {
        const u = new URL(url);
        return {
          host: u.hostname,
          port: Number(u.port) || 3306,
          user: decodeURIComponent(u.username),
          password: decodeURIComponent(u.password),
          database: u.pathname.replace(/^\//, ""),
        };
      } catch { return null; }
    }

    const dbUrl = process.env.DATABASE_URL || "";
    const fromUrl = dbUrl ? parseDbUrl(dbUrl) : null;

    // Bağlantı bilgileri (DATABASE_URL öncelikli)
    const host = fromUrl?.host || process.env.DB_HOST || "localhost";
    const port = fromUrl?.port || Number(process.env.DB_PORT) || 3306;
    const user = fromUrl?.user || process.env.DB_USER || "root";
    const password = fromUrl?.password || process.env.DB_PASSWORD || "";
    const database = fromUrl?.database || process.env.DB_NAME;

    const diag = {
      cwd: process.cwd(),
      envPath,
      envExists,
      envLoaded,
      hasDBUrl: !!dbUrl,
      dbUrlHost: fromUrl?.host || null,
      hasDbHost: !!process.env.DB_HOST,
      hasDbPort: !!process.env.DB_PORT,
      hasDbUser: !!process.env.DB_USER,
      hasDbPass: !!process.env.DB_PASSWORD,
      hasDbName: !!process.env.DB_NAME,
      resolvedHost: host,
      resolvedPort: port,
      resolvedDb: database,
    };

    // Bağlan
    const conn = await mysql.default.createConnection({
      host, port, user, password, database,
      connectTimeout: 15000,
    });

    const [tables] = await conn.query("SHOW TABLES");
    await conn.end();

    res.json({
      ok: true,
      diag,
      tableCount: tables.length,
      message: `MySQL OK. ${tables.length} tablo.`,
    });
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e?.message || String(e),
      code: e?.code || null,
    });
  }
});

/** Sistem Yedeği İndir */
router.get("/backup/download", auth, roleCheck(["admin"]), async (_req, res) => {
  try {
    await createBackup({ res });
  } catch (e) {
    console.error("GET /admin/backup/download", e);
    if (!res.headersSent) {
      const detail = e?.message || String(e);
      res.status(500).json({ message: `Yedekleme oluşturulamadı: ${detail}` });
    }
  }
});



/** Firma Ayarlarını Getir (ProviderProfile) */
router.get("/provider-profile", auth, roleCheck(["admin"]), async (req, res) => {
  try {
    let p = await prisma.providerProfile.findFirst();
    if (!p) p = await prisma.providerProfile.create({ data: { companyName: "Tura Çevre" } });
    res.json(p);
  } catch (e) {
    console.error("GET /admin/provider-profile", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/** Firma Ayarlarını Güncelle (ProviderProfile) */
router.put("/provider-profile", auth, roleCheck(["admin"]), async (req, res) => {
  try {
    let p = await prisma.providerProfile.findFirst();
    if (!p) p = await prisma.providerProfile.create({ data: { companyName: "Tura Çevre" } });

    const { companyName, address, responsibleTitle, responsibleName, phoneFax, certificateSerial, permissionNo } = req.body;

    const dataToUpdate = {};
    if (companyName !== undefined) dataToUpdate.companyName = String(companyName);
    if (address !== undefined) dataToUpdate.address = String(address);
    if (responsibleTitle !== undefined) dataToUpdate.responsibleTitle = String(responsibleTitle);
    if (responsibleName !== undefined) dataToUpdate.responsibleName = String(responsibleName);
    if (phoneFax !== undefined) dataToUpdate.phoneFax = String(phoneFax);
    if (certificateSerial !== undefined) dataToUpdate.certificateSerial = String(certificateSerial);
    if (permissionNo !== undefined) dataToUpdate.permissionNo = String(permissionNo);

    const updated = await prisma.providerProfile.update({
      where: { id: p.id },
      data: dataToUpdate,
    });

    res.json({ ok: true, providerProfile: updated });
  } catch (e) {
    console.error("PUT /admin/provider-profile", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/** Tek admin detay */
router.get("/:id", auth, roleCheck(["admin"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Geçersiz id" });

    const a = await prisma.admin.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        email: true,
        profileImage: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        lastSeenAt: true, // <<< ÖNEMLİ
      },
    });
    if (!a) return res.status(404).json({ message: "Kayıt bulunamadı" });
    res.json(a);
  } catch (e) {
    console.error("GET /admin/:id", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/** Admin oluştur */
router.post("/create", auth, roleCheck(["admin"]), async (req, res) => {
  try {
    const { fullName, email, password } = req.body || {};
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "Zorunlu alanlar eksik." });
    }
    const taken = await isEmailTaken(prisma, email);
    if (taken) return res.status(409).json({ message: "E-posta kullanımda (başka bir kullanıcı türünde olabilir)." });

    const hashed = await bcrypt.hash(String(password), 10);
    const created = await prisma.admin.create({
      data: { fullName, email, password: hashed },
      select: { id: true },
    });
    res.json({ ok: true, id: created.id });
  } catch (e) {
    console.error("POST /admin/create", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/** Admin güncelle */
router.put("/:id", auth, roleCheck(["admin"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Geçersiz id" });

    const { fullName, email, password } = req.body || {};
    const data = {};
    if (fullName !== undefined) data.fullName = String(fullName);
    if (email !== undefined) data.email = String(email);
    if (password) data.password = await bcrypt.hash(String(password), 10);

    const updated = await prisma.admin.update({
      where: { id },
      data,
      select: {
        id: true,
        fullName: true,
        email: true,
        updatedAt: true,
        lastSeenAt: true, // <<< ÖNEMLİ
      },
    });
    res.json({ ok: true, admin: updated });
  } catch (e) {
    if (e.code === "P2025")
      return res.status(404).json({ message: "Kayıt bulunamadı" });
    console.error("PUT /admin/:id", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

export default router;
