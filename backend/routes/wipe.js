// routes/wipe.js
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { auth, roleCheck } from "../middleware/auth.js";
import fs from "fs";
import path from "path";

const router = Router();
const prisma = new PrismaClient();

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

/** Klasör içeriğini (dosyalar + alt klasörler) boşaltır, kök klasörü bırakır */
function emptyDir(dir) {
  try {
    if (!fs.existsSync(dir)) return 0;
    let removed = 0;
    for (const entry of fs.readdirSync(dir)) {
      const p = path.join(dir, entry);
      try {
        const stat = fs.lstatSync(p);
        if (stat.isDirectory()) {
          removed += emptyDir(p);
          fs.rmdirSync(p, { recursive: true });
        } else {
          fs.unlinkSync(p);
          removed++;
        }
      } catch {
        // ignore
      }
    }
    return removed;
  } catch {
    return 0;
  }
}

router.post("/", auth, roleCheck(["admin"]), async (_req, res) => {
  try {
    // 1) Dosyalar: uploads içini boşalt
    const filesRemoved = emptyDir(UPLOAD_ROOT);

    // 2) Refresh tokens
    let refreshTokensDeleted = 0;
    try {
      const rt = await prisma.refreshToken?.deleteMany({});
      refreshTokensDeleted = rt?.count ?? 0;
    } catch {
      refreshTokensDeleted = 0;
    }

    // 3) FK sırası: çocuklardan ebeveynlere doğru
    // EK1 -> Visits
    try { await prisma.ek1?.deleteMany({}); } catch {}
    try { await prisma.stationActivation.deleteMany({}); } catch {}
    try { await prisma.nonconformity.deleteMany({}); } catch {}
    try { await prisma.visit.deleteMany({}); } catch {}
    try { await prisma.station.deleteMany({}); } catch {}
    try { await prisma.employeeTrackPoint.deleteMany({}); } catch {}

    // Store ve Customer
    try { await prisma.store.deleteMany({}); } catch {}
    try { await prisma.customer.deleteMany({}); } catch {}

    // Diğer bağımsız tablolar (opsiyonel)
    try { await prisma.biocide.deleteMany({}); } catch {}
    try { await prisma.providerProfile.deleteMany({}); } catch {}

    // Kullanıcılar (employee -> admin)
    let employeesDeleted = 0, adminsDeleted = 0, customersDeleted = 0;
    try { const r = await prisma.employee.deleteMany({}); employeesDeleted = r.count; } catch {}
    try { const r = await prisma.admin.deleteMany({}); adminsDeleted = r.count; } catch {}
    try { const r = await prisma.customer.deleteMany({}); customersDeleted = r.count; } catch {}

    return res.json({
      message: "Tüm veriler ve upload içeriği başarıyla silindi!",
      stats: {
        uploadsFilesRemoved: filesRemoved,
        refreshTokens: refreshTokensDeleted,
        stationActivations: "cleared",
        nonconformities: "cleared",
        visits: "cleared",
        stations: "cleared",
        employeeTrackPoints: "cleared",
        stores: "cleared",
        customers: customersDeleted,
        employees: employeesDeleted,
        admins: adminsDeleted,
        biocides: "cleared",
        providerProfile: "cleared",
      },
    });
  } catch (err) {
    console.error("WIPE error:", err);
    return res.status(500).json({ error: "Silme işlemi başarısız" });
  }
});

export default router;
