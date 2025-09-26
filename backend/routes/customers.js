// routes/customers.js
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { auth } from "../middleware/auth.js";

const router = Router();
const prisma = new PrismaClient();

// Yardımcı: sadece admin kontrolü
function checkAdmin(req, res) {
  if (req.user.role !== "admin") {
    res.status(403).json({ success: false, message: "Yalnızca adminler yapabilir." });
    return false;
  }
  return true;
}

// Admin şifresi doğrulama (email + password)
router.post("/verify-admin", auth, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: "Email ve şifre gerekli." });

    // Email ile admini bul
    const admin = await prisma.admins.findUnique({ where: { email } });
    if (!admin) return res.status(404).json({ success: false, message: "Admin bulunamadı." });

    // Şifre kontrolü
    const match = await bcrypt.compare(password, admin.password);
    if (!match) return res.status(401).json({ success: false, message: "Şifre yanlış." });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});


// Grup Şirket ekle
router.post("/add-group", auth, async (req, res) => {
  try {
    if (!checkAdmin(req, res)) return;

    const { name, email, title } = req.body;

    const newGroup = await prisma.customers.create({
      data: { name, email, title, parent_company_id: null },
    });

    res.json({ success: true, group: newGroup });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// Mağaza ekle
router.post("/add-store", auth, async (req, res) => {
  try {
    if (!checkAdmin(req, res)) return;

    const { name, email, title, parent_company_id } = req.body;

    const newStore = await prisma.customers.create({
      data: {
        name,
        email,
        title,
        parent_company_id: parent_company_id ? Number(parent_company_id) : null,
      },
    });

    res.json({ success: true, store: newStore });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// Müşterileri listele
router.get("/", auth, async (req, res) => {
  try {
    let customers;
    if (req.user.role === "admin") {
      customers = await prisma.customers.findMany();
    } else if (req.user.role === "employee") {
      customers = await prisma.customers.findMany({ where: { assigned_to: req.user.id } });
    } else {
      return res.status(403).json({ success: false, message: "Yetkisiz erişim" });
    }

    res.json(customers);  
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

export default router;
