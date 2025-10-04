// routes/auth.js
import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import { cookieOpts } from "../config/cookies.js"; 
dotenv.config();

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;

// REGISTER (Admin veya Employee)
router.post("/register", async (req, res) => {
  try {
    const { fullName, email, password, role, assignedTo } = req.body;

    if (!fullName || !email || !password || !role)
      return res.status(400).json({ error: "Eksik alanlar var." });

    const hashedPassword = await bcrypt.hash(password, 10);
    let user;

    if (role === "admin") {
      user = await prisma.admin.create({
        data: {
          fullName,
          email,
          password: hashedPassword,
          lastLoginAt: null,
          lastProfileAt: null,
        },
      });
    } else if (role === "employee") {
      user = await prisma.employee.create({
        data: {
          fullName,
          email,
          password: hashedPassword,
          adminId: assignedTo || null, // bağlı admin varsa
          lastLoginAt: null,
          lastProfileAt: null,
        },
      });
    } else {
      return res.status(400).json({ error: "Sadece admin veya employee eklenebilir." });
    }

    res.status(201).json({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (err) {
    console.error("Register hatası:", err);
    if (err.code === "P2002")
      return res.status(409).json({ error: "Bu email zaten kayıtlı." });

    res.status(500).json({ error: "Sunucu hatası." });
  }
});


// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    let user = null;
    let role = null;

    // Admin -> Employee -> Customer sırayla bak
    user = await prisma.admin.findUnique({ where: { email } });
    if (user) role = "admin";
    if (!user) {
      user = await prisma.employee.findUnique({ where: { email } });
      if (user) role = "employee";
    }
    if (!user) {
      user = await prisma.customer.findUnique({ where: { email } });
      if (user) role = "customer";
    }

    if (!user) return res.status(401).json({ message: "Kullanıcı bulunamadı" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: "Şifre hatalı" });

    const now = new Date();
    if (role === "admin") {
      await prisma.admin.update({ where: { id: user.id }, data: { lastLoginAt: now } });
    } else if (role === "employee") {
      await prisma.employee.update({ where: { id: user.id }, data: { lastLoginAt: now } });
    } else if (role === "customer") {
      await prisma.customer.update({ where: { id: user.id }, data: { lastLoginAt: now } });
    }

    const accessToken = jwt.sign({ id: user.id, role }, JWT_SECRET, { expiresIn: "15m" });
    const refreshToken = jwt.sign({ id: user.id, role }, JWT_SECRET, { expiresIn: "7d" });

    // Bileşik unique: @@unique([userId, role], name: "userId_role_unique")
    await prisma.refreshToken.upsert({
      where: { userId_role_unique: { userId: user.id, role } },
      update: {
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      create: {
        token: refreshToken,
        userId: user.id,
        role,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // TEK cookie formatı (path: "/")
    res.cookie("refreshToken", refreshToken, cookieOpts);

    res.json({
      accessToken,
      role,
      fullName: user.fullName,
      email: user.email,
    });
  } catch (err) {
    console.error("Login hatası:", err);
    res.status(500).json({ error: "DB hatası" });
  }
});

// REFRESH (korumasız olmalı)
router.post("/refresh", async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) return res.status(401).json({ message: "Refresh token gerekli" });

    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored) return res.status(403).json({ message: "Geçersiz refresh token" });

    jwt.verify(refreshToken, JWT_SECRET, async (err, decoded) => {
      if (err) return res.status(403).json({ message: "Token doğrulanamadı" });

      // Yeni access
      const newAccessToken = jwt.sign(
        { id: decoded.id, role: decoded.role },
        JWT_SECRET,
        { expiresIn: "15m" }
      );

      // İstersen burada ROTATION ekleyebilirsin
      // const newRefreshToken = jwt.sign({ id: decoded.id, role: decoded.role }, JWT_SECRET, { expiresIn: "7d" });
      // await prisma.refreshToken.update({ where: { token: refreshToken }, data: { token: newRefreshToken, expiresAt: new Date(Date.now() + 7*24*60*60*1000) } });
      // res.cookie("refreshToken", newRefreshToken, cookieOpts);

      return res.json({ accessToken: newAccessToken });
    });
  } catch (err) {
    console.error("Refresh hatası:", err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.post("/logout", async (req, res) => {
  try {
    const rt = req.cookies.refreshToken;

    // Cookie'yi set ederken ne verdiysen AYNISINI clear'da da ver
    res.clearCookie("refreshToken", cookieOpts);

    if (rt) {
      await prisma.refreshToken.deleteMany({ where: { token: rt } });
    }

    return res.json({ message: "Çıkış yapıldı" });
  } catch (err) {
    console.error("Logout hatası:", err);
    return res.status(500).json({ error: "Sunucu hatası" });
  }
});


export default router;
