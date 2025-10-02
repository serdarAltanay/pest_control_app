import express from "express";
import multer from "multer";
import path from "path";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import fs from "fs";

const prisma = new PrismaClient();
const router = express.Router();

// uploads klasörü yoksa oluştur
const uploadDir = "uploads";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  },
});

const upload = multer({ storage });

// JWT ile avatar güncelleme
router.post("/avatar", upload.single("avatar"), async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Token gerekli" });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { id, role } = decoded;

    if (!req.file) return res.status(400).json({ error: "Dosya yüklenmedi" });

    let user;
    if (role === "admin") {
      user = await prisma.admins.findUnique({ where: { id } });
    } else if (role === "employee") {
      user = await prisma.employees.findUnique({ where: { id } });
    } else if (role === "customer") {
      user = await prisma.customers.findUnique({ where: { id } });
    } else return res.status(400).json({ error: "Geçersiz rol" });

    if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı" });

    // 1️⃣ Mevcut profil fotoğrafını sil
    if (user.profileImage && fs.existsSync(user.profileImage)) {
      fs.unlinkSync(user.profileImage);
    }

    // 2️⃣ Yeni fotoğrafı kaydet
    const updateData = { profileImage: req.file.path };
    if (role === "admin") {
      user = await prisma.admins.update({ where: { id }, data: updateData });
    } else if (role === "employee") {
      user = await prisma.employees.update({ where: { id }, data: updateData });
    } else if (role === "customer") {
      user = await prisma.customers.update({ where: { id }, data: updateData });
    }

    res.json({ message: "Fotoğraf yüklendi", profileImage: user.profileImage });
  } catch (err) {
    console.error("Upload hatası:", err);
    res.status(500).json({ error: "DB hatası" });
  }
});


export default router;
