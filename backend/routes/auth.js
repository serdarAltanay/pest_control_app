// backend/routes/auth.js
import { Router } from "express";
import { auth } from "../middleware/auth.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import { cookieOpts } from "../config/cookies.js";
dotenv.config();

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;


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

    // 3) AccessOwner (müşteri paneli)
    if (!user) {
      user = await prisma.accessOwner.findUnique({ where: { email } });
      if (user) userType = "accessOwner";
    }

    if (!user) return res.status(401).json({ message: "Kullanıcı bulunamadı" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: "Şifre hatalı" });

    const now = new Date();
    if (userType === "admin") {
      await prisma.admin.update({ where: { id: user.id }, data: { lastLoginAt: now, lastSeenAt: now } });
    } else if (userType === "employee") {
      await prisma.employee.update({ where: { id: user.id }, data: { lastLoginAt: now, lastSeenAt: now } });
    } else if (userType === "accessOwner") {
      await prisma.accessOwner.update({ where: { id: user.id }, data: { lastLoginAt: now, lastSeenAt: now } });
    }

    // FE yönlendirmesi için (accessOwner → customer gibi davranır)
    const jwtRole = userType === "accessOwner" ? "customer" : userType;
    const dbRole = userType === "accessOwner" ? "accessOwner" : userType;

    // Access (15 dk)
    const accessToken = jwt.sign(
      { id: user.id, role: jwtRole, hasAcceptedTerms: user.hasAcceptedTerms || false },
      JWT_SECRET,
      { expiresIn: "15m" }
    );
    // Refresh (7 gün) — payload.role = jwtRole (customer)
    const refreshToken = jwt.sign(
      { id: user.id, role: jwtRole, hasAcceptedTerms: user.hasAcceptedTerms || false },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // DB'ye kaydet (unique userId+role)
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

    // Görünen ad normalize
    let fullName = "";
    if (userType === "admin" || userType === "employee") {
      fullName = user.fullName || "";
    } else if (userType === "accessOwner") {
      fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
    }

    res.json({
      accessToken,
      refreshToken,      // FE localStorage'a da kaydetsin (3rd-party cookie fallback)
      role: jwtRole,     // "customer" | "admin" | "employee"
      fullName,
      email: user.email,
      hasAcceptedTerms: user.hasAcceptedTerms || false,
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
    // Cookie VEYA body'den refresh token al (3rd-party cookie engellenebilir)
    const refreshToken = req.cookies.refreshToken?.trim() || req.body.refreshToken?.trim();
    console.log("[REFRESH] Cookie:", !!req.cookies.refreshToken, "Body:", !!req.body.refreshToken);
    if (!refreshToken) return res.status(401).json({ message: "Refresh token gerekli" });

    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored) {
      console.log("[REFRESH] Token not found in DB");
      return res.status(403).json({ message: "Geçersiz refresh token" });
    }

    jwt.verify(refreshToken, JWT_SECRET, async (err, decoded) => {
      if (err) {
        // Geçersiz veya süresi dolmuşsa DB'den temizle
        await prisma.refreshToken.delete({ where: { id: stored.id } });
        return res.status(403).json({ message: "Token doğrulanamadı" });
      }

      // Yeni Access Token
      const newAccessToken = jwt.sign(
        { id: decoded.id, role: decoded.role, hasAcceptedTerms: decoded.hasAcceptedTerms || false },
        JWT_SECRET,
        { expiresIn: "15m" }
      );

      // Refresh Token Rotation (RTR) - Güvenlik için her kullanımda RT yenilenir
      const newRefreshToken = jwt.sign(
        { id: decoded.id, role: decoded.role, hasAcceptedTerms: decoded.hasAcceptedTerms || false },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      await prisma.refreshToken.update({
        where: { id: stored.id },
        data: {
          token: newRefreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      res.cookie("refreshToken", newRefreshToken, cookieOpts);
      return res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
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

    // ÇEREZİ SİL — set ederken kullandığın cookieOpts ile AYNI
    res.clearCookie("refreshToken", cookieOpts);

    // DB'deki kaydı da sil
    if (rt) {
      await prisma.refreshToken.deleteMany({ where: { token: rt } });
    }

    return res.json({ message: "Çıkış yapıldı" });
  } catch (err) {
    console.error("Logout hatası:", err);
    return res.status(500).json({ error: "Sunucu hatası" });
  }
});

/* -----------------
 * KVKK CONSENT LOG
 * ----------------- */
router.post("/consent", auth, async (req, res) => {
  try {
    const { id, role } = req.user;
    const { consentType } = req.body;

    // Convert frontend role to db role
    const dbRole = role === "customer" ? "accessOwner" : role;

    if (dbRole === "admin") await prisma.admin.update({ where: { id }, data: { hasAcceptedTerms: true } });
    else if (dbRole === "employee") await prisma.employee.update({ where: { id }, data: { hasAcceptedTerms: true } });
    else if (dbRole === "accessOwner") await prisma.accessOwner.update({ where: { id }, data: { hasAcceptedTerms: true } });

    await prisma.consentLog.create({
      data: {
        userId: id,
        userRole: dbRole,
        consentType: consentType || "COMBINED_TOS_PRIVACY",
        ipAddress: req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress,
        userAgent: req.headers["user-agent"],
      },
    });

    const newAccessToken = jwt.sign(
      { id, role, hasAcceptedTerms: true },
      JWT_SECRET,
      { expiresIn: "15m" }
    );

    const newRefreshToken = jwt.sign(
      { id, role, hasAcceptedTerms: true },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    await prisma.refreshToken.updateMany({
      where: { userId: id, role: dbRole },
      data: { token: newRefreshToken, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
    });

    res.cookie("refreshToken", newRefreshToken, cookieOpts);

    return res.json({ message: "Consent recorded successfully", accessToken: newAccessToken });
  } catch (err) {
    console.error("Consent error:", err);
    return res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;
