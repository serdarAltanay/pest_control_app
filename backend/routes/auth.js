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

    const token = jwt.sign({ id: user.id, role }, JWT_SECRET, { expiresIn: "1d" });

    res.json({ token, role, name: user.name, email: user.email });
  } catch (err) {
    console.error("Login hatası:", err);
    res.status(500).json({ error: "DB hatası" });
  }
});

export default router;
