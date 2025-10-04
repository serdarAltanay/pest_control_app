// backend/routes/wipe.js
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { auth, roleCheck } from "../middleware/auth.js";

const router = Router();
const prisma = new PrismaClient();

router.post("/", auth, roleCheck(["admin"]), async (_req, res) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const rt = await tx.refreshToken?.deleteMany({}).catch(() => ({ count: 0 }));
      const c  = await tx.customer.deleteMany({});
      const e  = await tx.employee.deleteMany({});
      const a  = await tx.admin.deleteMany({});
      return {
        refreshTokens: rt?.count ?? 0,
        customers: c.count,
        employees: e.count,
        admins: a.count,
      };
    });

    res.json({ message: "Tüm veriler başarıyla silindi!", stats: result });
  } catch (err) {
    console.error("WIPE error:", err);
    res.status(500).json({ error: "Silme işlemi başarısız" });
  }
});

export default router;
