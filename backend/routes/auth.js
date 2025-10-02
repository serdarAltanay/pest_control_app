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
    const { name, email, password, role, assigned_to } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    let user;

    if (role === "admin") {
      user = await prisma.admins.create({
        data: {
          name,
          email,
          password: hashedPassword,
          lastLoginAt: null,
          lastProfileAt: null,
        },
      });
    } else if (role === "employee") {
      user = await prisma.employees.create({
        data: {
          name,
          email,
          password: hashedPassword,
          assigned_to: assigned_to || null,
          lastLoginAt: null,
          lastProfileAt: null,
        },
      });
    } else {
      return res.status(400).json({ error: "Sadece admin veya employee eklenebilir" });
    }

    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (err) {
    console.error("Register hatası:", err);
    // Unique email hatası vs. için dilersen P2002 yakalayıp 409 dönebilirsin
    res.status(500).json({ error: "DB hatası" });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    let user = null;
    let role = null;

    // Admin -> Employee -> Customer sırayla bak
    user = await prisma.admins.findUnique({ where: { email } });
    if (user) role = "admin";
    if (!user) {
      user = await prisma.employees.findUnique({ where: { email } });
      if (user) role = "employee";
    }
    if (!user) {
      user = await prisma.customers.findUnique({ where: { email } });
      if (user) role = "customer";
    }

    if (!user) return res.status(401).json({ message: "Kullanıcı bulunamadı" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: "Şifre hatalı" });

    const now = new Date();
    if (role === "admin") {
      await prisma.admins.update({ where: { id: user.id }, data: { lastLoginAt: now } });
    } else if (role === "employee") {
      await prisma.employees.update({ where: { id: user.id }, data: { lastLoginAt: now } });
    } else if (role === "customer") {
      await prisma.customers.update({ where: { id: user.id }, data: { lastLoginAt: now } });
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
      name: user.name,
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
