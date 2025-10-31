// routes/profile.js
import express from "express";
import { PrismaClient } from "@prisma/client";
import { auth } from "../middleware/auth.js";

const prisma = new PrismaClient();
const profileRouter = express.Router();

// Korumalı, auth middleware'i kullan
profileRouter.get("/", auth, async (req, res) => {
  try {
    const { id, role } = req.user;

    // admin
    if (role === "admin") {
      const u = await prisma.admin.findUnique({ where: { id } });
      if (!u) return res.status(404).json({ error: "Kullanıcı bulunamadı" });
      return res.json({
        id: u.id,
        role,
        email: u.email,
        fullName: u.fullName || "",
        // ÖNEMLİ: default görsel döndürmeyelim; FE fallback kullanacak
        profileImage: u.profileImage || null,
      });
    }

    // employee
    if (role === "employee") {
      const u = await prisma.employee.findUnique({ where: { id } });
      if (!u) return res.status(404).json({ error: "Kullanıcı bulunamadı" });
      return res.json({
        id: u.id,
        role,
        email: u.email,
        fullName: u.fullName || "",
        profileImage: u.profileImage || null,
      });
    }

    // customer (ÖNCE AccessOwner dene)
    if (role === "customer") {
      const ao = await prisma.accessOwner.findUnique({ where: { id } });
      if (ao) {
        const fullName = [ao.firstName, ao.lastName].filter(Boolean).join(" ") || ao.email;
        return res.json({
          id: ao.id,
          role: "customer",            // FE için customer kalır
          accessOwnerRole: ao.role,    // iş rolü
          email: ao.email,
          firstName: ao.firstName || null,
          lastName: ao.lastName || null,
          fullName,
          profileImage: ao.profileImage || null,
        });
      }

      // (opsiyonel) Eski sistem gerçek Customer login’i (kullanmayacaksın ama fallback)
      const c = await prisma.customer.findUnique({ where: { id } });
      if (!c) return res.status(404).json({ error: "Kullanıcı bulunamadı" });
      return res.json({
        id: c.id,
        role: "customer",
        email: c.email || null,
        fullName: c.contactFullName || c.title || "",
        contactFullName: c.contactFullName || null,
        company: c.title || null,
        profileImage: c.profileImage || null,
      });
    }

    return res.status(400).json({ error: "Bilinmeyen rol" });
  } catch (err) {
    console.error("Profile hatası:", err);
    res.status(500).json({ error: "DB hatası" });
  }
});

// İsim güncelleme
profileRouter.put("/update-info", auth, async (req, res) => {
  try {
    const { id, role } = req.user;
    const { fullName, firstName, lastName } = req.body || {};

    if (role === "admin") {
      const u = await prisma.admin.update({ where: { id }, data: { fullName: fullName || "" } });
      return res.json({ success: true, user: { id: u.id, fullName: u.fullName, email: u.email, profileImage: u.profileImage } });
    }

    if (role === "employee") {
      const u = await prisma.employee.update({ where: { id }, data: { fullName: fullName || "" } });
      return res.json({ success: true, user: { id: u.id, fullName: u.fullName, email: u.email, profileImage: u.profileImage } });
    }

    if (role === "customer") {
      // AccessOwner ise first/last yaz
      const ao = await prisma.accessOwner.findUnique({ where: { id } });
      if (ao) {
        // fullName gönderildiyse bölüp yaz, yoksa first/last kullan
        let f = firstName, l = lastName;
        if (!f && !l && fullName) {
          const parts = String(fullName).trim().split(/\s+/);
          l = parts.length > 1 ? parts.pop() : "";
          f = parts.join(" ") || fullName;
        }
        const u = await prisma.accessOwner.update({
          where: { id },
          data: { firstName: f || null, lastName: l || null },
        });
        return res.json({
          success: true,
          user: {
            id: u.id,
            fullName: [u.firstName, u.lastName].filter(Boolean).join(" "),
            email: u.email,
            profileImage: u.profileImage,
          },
        });
      }

      // (opsiyonel) gerçek customer ise contactFullName’i güncelle
      if (fullName) {
        const c = await prisma.customer.update({ where: { id }, data: { contactFullName: fullName } });
        return res.json({
          success: true,
          user: { id: c.id, fullName: c.contactFullName, email: c.email, profileImage: c.profileImage },
        });
      }

      return res.status(400).json({ error: "Güncellenecek alan bulunamadı" });
    }

    return res.status(400).json({ error: "Bilinmeyen rol" });
  } catch (err) {
    console.error("Update profile info hatası:", err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default profileRouter;
