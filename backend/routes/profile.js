// routes/profile.js
import express from "express";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { auth } from "../middleware/auth.js";

const prisma = new PrismaClient();
const profileRouter = express.Router();

profileRouter.get("/", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Token gerekli" });

    const token = authHeader.split(" ")[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: "Geçersiz token" });
    }

    const { id, role } = decoded;
    const userId = Number(id);

    let user;
    if (role === "admin") {
      user = await prisma.admin.findUnique({ where: { id: userId } });
    } else if (role === "employee") {
      user = await prisma.employee.findUnique({ where: { id: userId } });
    } else if (role === "customer") {
      user = await prisma.customer.findUnique({ where: { id: userId } });
    }

    if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı" });

    // Tüm rollerde 'fullName' alanını doldur
    const fullName =
      role === "customer"
        ? (user.contactFullName ?? user.title ?? "")
        : (user.fullName ?? "");

    const profileData = {
      id: user.id,
      role,
      email: user.email ?? null,
      fullName, // <-- UI'nın güvenle kullanabileceği tek alan
      contactFullName: role === "customer" ? (user.contactFullName ?? null) : null,
      company: role === "customer" ? (user.title ?? null) : null, // müşteri için şirket adı
      profileImage: user.profileImage || "/noavatar.jpg",
    };

    res.json(profileData);
  } catch (err) {
    console.error("Profile hatası:", err);
    res.status(500).json({ error: "DB hatası" });
  }
});



profileRouter.put("/update-info", auth, async (req, res) => {
  try {
    const { fullName } = req.body;
    const { id, role } = req.user;

    if (!fullName) {
      return res.status(400).json({ error: "İsim gerekli" });
    }

    let updatedUser;
    if (role === "admin") {
      updatedUser = await prisma.admin.update({
        where: { id },
        data: { fullName },
      });
    } else if (role === "employee") {
      updatedUser = await prisma.employee.update({
        where: { id },
        data: { fullName },
      });
    } else if (role === "customer") {
      updatedUser = await prisma.customer.update({
        where: { id },
        data: { fullName },
      });
    }

    res.json({ success: true, user: {
      id: updatedUser.id,
      fullName: updatedUser.fullName,
      email: updatedUser.email,
      profileImage: updatedUser.profileImage,
    } });
  } catch (err) {
    console.error("Update profile info hatası:", err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});


export default profileRouter;
