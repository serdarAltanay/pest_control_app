// routes/profile.js
import express from "express";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";


const prisma = new PrismaClient();

const profileRouter = express.Router();

profileRouter.get("/", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Token gerekli" });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { id, role } = decoded;

    let user = null;
    if (role === "admin") {
      user = await prisma.admins.findUnique({ where: { id } });
    } else if (role === "employee") {
      user = await prisma.employees.findUnique({ where: { id } });
    } else if (role === "customer") {
      user = await prisma.customers.findUnique({ where: { id } });
    }

    if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı" });

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role,
      company: user.company || null,
    });
  } catch (err) {
    console.error("Profile hatası:", err);
    res.status(500).json({ error: "DB hatası" });
  }
});

export default profileRouter;
