import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const router = Router();
const prisma = new PrismaClient();

// Tek seferlik seed API
router.post("/", async (req, res) => {
  try {
    // 1�,?��� Admin ekle
    const adminPassword = await bcrypt.hash("admin123", 10);
    const admin = await prisma.admin.create({
      data: {
        name: "Admin Test",
        email: "admin@test.com",
        password: adminPassword,
      },
    });

    // 2�,?��� Employee ekle (admin'e ba�Yl��)
    const employeePassword = await bcrypt.hash("employee123", 10);
    const employee = await prisma.employee.create({
      data: {
        name: "A�al��Yan Test",
        email: "employee@test.com",
        password: employeePassword,
        assignedTo: admin.id,
      },
    });

    // 3�,?��� Bireysel mA��Yteri ekle
    await prisma.customers.create({
      data: {
        name: "Ahmet Y��lmaz",
        email: "ahmet@gmail.com",
        title: "Bireysel MA��Yteri",
        assigned_to: employee.id,
      },
    });

    // 4�,?��� Parent Company ekle
    const parentCompany = await prisma.customer.create({
      data: {
        name: "ABC Holding",
        email: "info@abc.com",
        title: "�zirket",
        assigned_to: employee.id,
      },
    });

    // 5�,?��� Ma�Yazalar ekle
    await prisma.customers.createMany({
      data: [
        {
          name: "ABC Ma�Yaza 1",
          email: "magaza1@abc.com",
          title: "Ma�Yaza MA�dA�rA�",
          assigned_to: employee.id,
          parent_company_id: parentCompany.id,
        },
        {
          name: "ABC Ma�Yaza 2",
          email: "magaza2@abc.com",
          title: "Ma�Yaza MA�dA�rA�",
          assigned_to: employee.id,
          parent_company_id: parentCompany.id,
        },
      ],
    });

    res.json({ message: "Seed verileri ba�Yar��yla eklendi!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
