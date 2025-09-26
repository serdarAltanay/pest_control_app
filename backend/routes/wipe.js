// routes/wipe.js
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { auth, roleCheck } from "../middleware/auth.js";

const router = Router();
const prisma = new PrismaClient();

// Tüm verileri sil, sadece admin yapabilir
router.post("/", auth, roleCheck(["admin"]), async (req, res) => {
  try {
    await prisma.customers.deleteMany();
    await prisma.employees.deleteMany();
    await prisma.admins.deleteMany();

    res.json({ message: "Tüm veriler başarıyla silindi!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
