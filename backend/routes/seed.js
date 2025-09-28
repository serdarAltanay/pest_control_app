import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const router = Router();
const prisma = new PrismaClient();

// Tek seferlik seed API
router.post("/", async (req, res) => {
  try {
    // 1️⃣ Admin ekle
    const adminPassword = await bcrypt.hash("admin123", 10);
    const admin = await prisma.admin.create({
      data: {
        name: "Admin Test",
        email: "admin@test.com",
        password: adminPassword,
      },
    });

    // 2️⃣ Employee ekle (admin'e bağlı)
    const employeePassword = await bcrypt.hash("employee123", 10);
    const employee = await prisma.employee.create({
      data: {
        name: "Çalışan Test",
        email: "employee@test.com",
        password: employeePassword,
        assignedTo: admin.id,
      },
    });

    // 3️⃣ Bireysel müşteri ekle
    await prisma.customers.create({
      data: {
        name: "Ahmet Yılmaz",
        email: "ahmet@gmail.com",
        title: "Bireysel Müşteri",
        assigned_to: employee.id,
      },
    });

    // 4️⃣ Parent Company ekle
    const parentCompany = await prisma.customer.create({
      data: {
        name: "ABC Holding",
        email: "info@abc.com",
        title: "Şirket",
        assigned_to: employee.id,
      },
    });

    // 5️⃣ Mağazalar ekle
    await prisma.customers.createMany({
      data: [
        {
          name: "ABC Mağaza 1",
          email: "magaza1@abc.com",
          title: "Mağaza Müdürü",
          assigned_to: employee.id,
          parent_company_id: parentCompany.id,
        },
        {
          name: "ABC Mağaza 2",
          email: "magaza2@abc.com",
          title: "Mağaza Müdürü",
          assigned_to: employee.id,
          parent_company_id: parentCompany.id,
        },
      ],
    });

    res.json({ message: "Seed verileri başarıyla eklendi!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
