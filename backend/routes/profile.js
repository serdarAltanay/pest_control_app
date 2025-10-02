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
        user = await prisma.admins.findUnique({ where: { id: userId } });
      } else if (role === "employee") {
        user = await prisma.employees.findUnique({ where: { id: userId } });
      } else if (role === "customer") {
        user = await prisma.customers.findUnique({ where: { id: userId } });
      }

    if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı" });

    const profileData = {
      id: user.id,
      name: user.name,
      email: user.email,
      role,
      profileImage: user.profileImage || "/noavatar.jpg",
    };

    // Sadece customer için company ekle
    if (role === "customer") {
      profileData.company = user.company || null;
    }

    res.json(profileData);
  } catch (err) {
    console.error("Profile hatası:", err);
    res.status(500).json({ error: "DB hatası" });
  }
});


profileRouter.put("/update-info", auth, async (req, res) => {
  try {
    const { name } = req.body;
    const { id, role } = req.user;

    if (!name) {
      return res.status(400).json({ error: "İsim gerekli" });
    }

    let updatedUser;
    if (role === "admin") {
      updatedUser = await prisma.admins.update({
        where: { id },
        data: { name },
      });
    } else if (role === "employee") {
      updatedUser = await prisma.employees.update({
        where: { id },
        data: { name },
      });
    } else if (role === "customer") {
      updatedUser = await prisma.customers.update({
        where: { id },
        data: { name },
      });
    }

    res.json({ success: true, user: updatedUser });
  } catch (err) {
    console.error("Update profile info hatası:", err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});


export default profileRouter;
