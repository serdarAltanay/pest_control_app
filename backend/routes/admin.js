import express from "express";
import bcrypt from "bcryptjs";
import { auth, roleCheck } from "../middleware/auth.js";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

router.post("/add-user", auth, roleCheck(["admin"]), async (req, res) => {
  try {
    const { name, email, password, role, assigned_to, parent_company_id, store_id, title } = req.body;

    if (!name || !role) {
      return res.status(400).json({ message: "Ad ve rol zorunludur" });
    }

    if (email) {
      let existingUser;
      if (role === "admin") existingUser = await prisma.admins.findUnique({ where: { email } });
      else if (role === "employee") existingUser = await prisma.employees.findUnique({ where: { email } });
      else existingUser = await prisma.customers.findUnique({ where: { email } });

      if (existingUser) return res.status(400).json({ message: "Bu email zaten kayıtlı" });
    }

    if (role === "admin") {
      const hashedPassword = password ? await bcrypt.hash(password, 10) : null;
      const newAdmin = await prisma.admins.create({
        data: { name, email, password: hashedPassword },
      });
      return res.json({ message: "Admin başarıyla eklendi", user: newAdmin });
    }

    if (role === "employee") {
      if (!assigned_to) return res.status(400).json({ message: "Employee için assigned_to gerekli (admin id)" });
      const hashedPassword = password ? await bcrypt.hash(password, 10) : null;
      const newEmployee = await prisma.employees.create({
        data: { name, email, password: hashedPassword, assigned_to: assigned_to || null },
      });
      return res.json({ message: "Employee başarıyla eklendi", user: newEmployee });
    }

    if (role === "customer") {
      if (!assigned_to) return res.status(400).json({ message: "Customer için assigned_to gerekli (employee id)" });
      const hashedPassword = password ? await bcrypt.hash(password, 10) : null;
      const newCustomer = await prisma.customers.create({
        data: {
          name,
          email,
          password: hashedPassword,
          title: title || null,
          assigned_to,
          parent_company_id: parent_company_id || null,
          store_id: store_id || null,
        },
      });
      return res.json({ message: "Customer başarıyla eklendi", user: newCustomer });
    }

    res.status(400).json({ message: "Geçersiz rol" });

  } catch (err) {
    console.error("Add user error:", err);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

export default router;
