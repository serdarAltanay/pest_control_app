import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { auth, roleCheck } from "../middleware/auth.js";
import { createBackup } from "../lib/backup.js";

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
    const dotenv = await import("dotenv");
    dotenv.config();

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

    const fromUrl = process.env.DATABASE_URL ? parseDbUrl(process.env.DATABASE_URL) : null;
    const cfg = {
      host: process.env.DB_HOST || fromUrl?.host || "localhost",
      port: Number(process.env.DB_PORT) || fromUrl?.port || 3306,
      user: process.env.DB_USER || fromUrl?.user || "root",
      password: process.env.DB_PASSWORD ? "***SET***" : (fromUrl?.password ? "***FROM_URL***" : "***EMPTY***"),
      database: process.env.DB_NAME || fromUrl?.database,
    };

    // Dene bağlan
    const conn = await mysql.default.createConnection({
      host: cfg.host,
      port: cfg.port,
      user: process.env.DB_USER || fromUrl?.user || "root",
      password: process.env.DB_PASSWORD || fromUrl?.password || "",
      database: cfg.database,
      connectTimeout: 15000,
    });

    const [tables] = await conn.query("SHOW TABLES");
    await conn.end();

    res.json({
      ok: true,
      config: cfg,
      tableCount: tables.length,
      message: `MySQL bağlantısı başarılı. ${tables.length} tablo bulundu.`,
    });
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e?.message || String(e),
      code: e?.code || null,
      errno: e?.errno || null,
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

/** Sunucuya Yedekleme Yap */
router.post("/backup/server", auth, roleCheck(["admin"]), async (_req, res) => {
  try {
    const filename = await createBackup({ saveToDisk: true });
    res.json({ ok: true, message: `Yedekleme başarıyla tamamlandı: ${filename}` });
  } catch (e) {
    console.error("POST /admin/backup/server", e);
    res.status(500).json({ message: "Sunucu yedeklemesi başarısız oldu" });
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
    const exists = await prisma.admin.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ message: "E-posta kullanımda." });

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
