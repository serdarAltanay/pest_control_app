// routes/contacts.js
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { auth, roleCheck } from "../middleware/auth.js";

const prisma = new PrismaClient();
const router = Router();

/** Güvenli telefon alanı seçici (şema farklılıklarına dayanıklı) */
function pickPhone(u = {}) {
  return (
    u.gsm ||
    u.phone ||
    u.mobile ||
    u.cell ||
    u.tel ||
    u.telephone ||
    null
  );
}

router.get(
  "/",
  auth,
  // İletişim sayfasını herkes görebilsin istersen: ["admin","employee","customer"]
  roleCheck(["customer", "admin", "employee"]),
  async (req, res) => {
    try {
      // Select koymadan tüm alanları alıyoruz → şema farklarında hata riskini sıfırlar
      const adminsRaw = await prisma.admin.findMany();
      const employeesRaw = await prisma.employee.findMany();

      const admins = adminsRaw.map((u) => ({
        id: u.id,
        name: u.fullName || u.name || u.email || `Admin #${u.id}`,
        email: u.email || null,
        phone: pickPhone(u),
        profileImage: u.profileImage || null,
        role: "ADMIN",
      }));

      const employees = employeesRaw.map((u) => ({
        id: u.id,
        name: u.fullName || u.name || u.email || `Personel #${u.id}`,
        email: u.email || null,
        phone: pickPhone(u),
        profileImage: u.profileImage || null,
        role: "EMPLOYEE",
      }));

      res.json({ admins, employees });
    } catch (e) {
      console.error("GET /contacts error:", e);
      res.status(500).json({ error: "Sunucu hatası" });
    }
  }
);

export default router;
