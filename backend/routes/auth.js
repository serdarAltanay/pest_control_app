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

/* ---------------------------------------------------
 * REGISTER (sadece admin/employee eklemek için mevcut)
 * --------------------------------------------------- */
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
          lastSeenAt: null,
          lastProfileAt: null,
        },
      });
    } else if (role === "employee") {
      user = await prisma.employee.create({
        data: {
          fullName,
          email,
          password: hashedPassword,
          adminId: assignedTo || null,
          lastLoginAt: null,
          lastSeenAt: null,
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

/* ----------------
 * LOGIN (yeni sistem)
 * ---------------- */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    let user = null;
    let userType = null;

    // 1) Admin
    user = await prisma.admin.findUnique({ where: { email } });
    if (user) userType = "admin";

    // 2) Employee
    if (!user) {
      user = await prisma.employee.findUnique({ where: { email } });
      if (user) userType = "employee";
    }

    // 3) AccessOwner (erişim sahibi) -> müşteri rolüyle oturum
    if (!user) {
      user = await prisma.accessOwner.findUnique({ where: { email } });
      if (user) userType = "accessOwner";
    }

    if (!user) return res.status(401).json({ message: "Kullanıcı bulunamadı" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: "Şifre hatalı" });

    const now = new Date();
    // lastLoginAt / lastSeenAt güncelle
    if (userType === "admin") {
      await prisma.admin.update({ where: { id: user.id }, data: { lastLoginAt: now, lastSeenAt: now } });
    } else if (userType === "employee") {
      await prisma.employee.update({ where: { id: user.id }, data: { lastLoginAt: now, lastSeenAt: now } });
    } else if (userType === "accessOwner") {
      await prisma.accessOwner.update({ where: { id: user.id }, data: { lastLoginAt: now, lastSeenAt: now } });
    } else if (userType === "customer") {
      await prisma.customer.update({ where: { id: user.id }, data: { lastLoginAt: now, lastSeenAt: now } });
    }

    // FE yönlendirmesi için: accessOwner da "customer" gibi davransın
    const jwtRole = userType === "accessOwner" ? "customer" : userType;
    // RefreshToken tablosunda çakışmayı önlemek için DB'de tutulan rol:
    const dbRole = userType === "accessOwner" ? "accessOwner" : userType;

    // Access token (15 dk) — FE bu role ile route eder
    const accessToken = jwt.sign({ id: user.id, role: jwtRole }, JWT_SECRET, { expiresIn: "15m" });
    // Refresh token (7 gün) — payload role'ü yine jwtRole (customer) olsun ki refresh sonrası da FE aynı kalsın
    const refreshToken = jwt.sign({ id: user.id, role: jwtRole }, JWT_SECRET, { expiresIn: "7d" });

    // DB'ye kaydet (unique: userId+role) — role için dbRole kullan
    await prisma.refreshToken.upsert({
      where: { userId_role_unique: { userId: user.id, role: dbRole } },
      update: {
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      create: {
        token: refreshToken,
        userId: user.id,
        role: dbRole,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Cookie olarak refresh token
    res.cookie("refreshToken", refreshToken, cookieOpts);

    // Görünen ad — tabloya göre normalize et
    let fullName = "";
    if (userType === "admin" || userType === "employee") {
      fullName = user.fullName || "";
    } else if (userType === "accessOwner") {
      fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
    } else if (userType === "customer") {
      // şemanıza göre uyarlayın; title ya da contactFullName olabilir
      fullName = user.fullName || user.title || user.contactFullName || user.email;
    }

    res.json({
      accessToken,
      role: jwtRole,     // "customer" | "admin" | "employee"
      fullName,
      email: user.email,
    });
  } catch (err) {
    console.error("Login hatası:", err);
    res.status(500).json({ error: "DB hatası" });
  }
});

/* -------------
 * REFRESH TOKEN
 * ------------- */
router.post("/refresh", async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) return res.status(401).json({ message: "Refresh token gerekli" });

    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored) return res.status(403).json({ message: "Geçersiz refresh token" });

    jwt.verify(refreshToken, JWT_SECRET, async (err, decoded) => {
      if (err) return res.status(403).json({ message: "Token doğrulanamadı" });

      // Yeni access: refresh içindeki role neyse aynısını veriyoruz (accessOwner da "customer" olarak kalır)
      const newAccessToken = jwt.sign(
        { id: decoded.id, role: decoded.role },
        JWT_SECRET,
        { expiresIn: "15m" }
      );

      return res.json({ accessToken: newAccessToken });
    });
  } catch (err) {
    console.error("Refresh hatası:", err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

/* -------
 * LOGOUT
 * ------- */
router.post("/logout", async (req, res) => {
  try {
    const rt = req.cookies.refreshToken;

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
