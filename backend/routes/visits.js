import { Router } from "express";
import { auth, roleCheck } from "../middleware/auth.js";
const router = Router();

// Mock / basit tablodan dönecek şekilde sonra güncelleriz
router.get("/store/:storeId", auth, roleCheck(["admin","employee"]), async (req, res) => {
  const storeId = Number(req.params.storeId);
  if (!storeId) return res.status(400).json({ message: "Geçersiz storeId" });
  // şimdilik boş/liste
  res.json([
    // örnek obje formatı:
    // { id: 1, date: "2025-10-04", time: "08:00/08:30", company: "DEPOOS YEDEK PARÇA", visitType: "Periyodik Ziyaret", actor: "Sistem Yöneticisi" }
  ]);
});

export default router;
