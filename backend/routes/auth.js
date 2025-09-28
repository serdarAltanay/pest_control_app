// routes/auth.js
import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
dotenv.config();

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;

// REGISTER (Admin veya Employee)
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role, assigned_to } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    let user;

    if (role === "admin") {
      user = await prisma.admins.create({
        data: { name, email, password: hashedPassword },
      });
    } else if (role === "employee") {
      user = await prisma.employees.create({
        data: { name, email, password: hashedPassword, assigned_to: assigned_to || null },
      });
    } else {
      return res.status(400).json({ error: "Sadece admin veya employee eklenebilir" });
    }

    res.json({ id: user.id, name: user.name, email: user.email, role });
  } catch (err) {
    console.error("Register hatası:", err);
    res.status(500).json({ error: "DB hatası" });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    let user = null;
    let role = null;

    // Admin ara
    user = await prisma.admins.findUnique({ where: { email } });
    if (user) role = "admin";
    else {
      user = await prisma.employees.findUnique({ where: { email } });
      if (user) role = "employee";
      else {
        user = await prisma.customers.findUnique({ where: { email } });
        if (user) role = "customer";
      }
    }

    if (!user) return res.status(401).json({ message: "Kullanıcı bulunamadı" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: "Şifre hatalı" });

    // Access token (kısa ömürlü)
    const accessToken = jwt.sign({ id: user.id, role }, JWT_SECRET, { expiresIn: "15m" });

    // Refresh token (uzun ömürlü)
    const refreshToken = jwt.sign({ id: user.id, role }, JWT_SECRET, { expiresIn: "7d" });

    // Refresh tokeni DB’de sakla
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        role,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 gün
      },
    });

    res.json({ accessToken, refreshToken, role, name: user.name, email: user.email });
  } catch (err) {
    console.error("Login hatası:", err);
    res.status(500).json({ error: "DB hatası" });
  }
});

// REFRESH TOKEN
router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ message: "Refresh token gerekli" });

    // DB’de token var mı?
    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored) return res.status(403).json({ message: "Geçersiz refresh token" });

    // JWT doğrula
    jwt.verify(refreshToken, JWT_SECRET, async (err, decoded) => {
      if (err) return res.status(403).json({ message: "Refresh token süresi dolmuş" });

      const { id, role } = decoded;

      // Yeni access token üret
      const newAccessToken = jwt.sign({ id, role }, JWT_SECRET, { expiresIn: "15m" });

      res.json({ accessToken: newAccessToken });
    });
  } catch (err) {
    console.error("Refresh hatası:", err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.post("/logout", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    }
    res.json({ message: "Çıkış yapıldı" });
  } catch (err) {
    console.error("Logout hatası:", err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});


export default router;
