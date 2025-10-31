import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { auth, roleCheck } from "../middleware/auth.js";

const prisma = new PrismaClient();
const router = Router();

const UNIT_VALUES = ["ML","GR","LT","KG","ADET"];
const toId = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/* Listeleme:
   - Admin + Employee erişebilir.
   - Eğer müşterinin de görmesi istenirse roleCheck içine "customer" ekleyebilirsin. */
router.get("/", auth, roleCheck(["admin","employee"]), async (_req,res) => {
  try {
    const rows = await prisma.biocide.findMany({ orderBy: { name: "asc" } });
    res.json(rows);
  } catch (e) {
    console.error("GET /biocides", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/* Ekleme:
   - Admin + Employee */
router.post("/", auth, roleCheck(["admin","employee"]), async (req,res) => {
  try {
    let { name, activeIngredient, antidote, unit } = req.body || {};
    name = String(name || "").trim();
    activeIngredient = String(activeIngredient || "").trim();
    antidote = String(antidote || "").trim();
    unit = String(unit || "").trim().toUpperCase();

    if (!name || !activeIngredient || !antidote || !unit) {
      return res.status(400).json({ message: "name, activeIngredient, antidote, unit zorunludur."});
    }
    if (!UNIT_VALUES.includes(unit)) return res.status(400).json({ message: "Geçersiz unit" });

    const created = await prisma.biocide.create({
      data: { name, activeIngredient, antidote, unit }
    });
    res.json({ message: "Biyosidal eklendi", biocide: created });
  } catch (e) {
    if (e?.code === "P2002") {
      return res.status(409).json({ message: "Bu biyosidal zaten var." });
    }
    console.error("POST /biocides", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/* Güncelleme:
   - Admin + Employee */
router.put("/:id", auth, roleCheck(["admin","employee"]), async (req,res) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ message: "Geçersiz id" });

    const data = {};
    if ("name" in req.body) data.name = String(req.body.name || "").trim();
    if ("activeIngredient" in req.body) data.activeIngredient = String(req.body.activeIngredient || "").trim();
    if ("antidote" in req.body) data.antidote = String(req.body.antidote || "").trim();
    if ("unit" in req.body) {
      const u = String(req.body.unit || "").trim().toUpperCase();
      if (!UNIT_VALUES.includes(u)) return res.status(400).json({ message: "Geçersiz unit" });
      data.unit = u;
    }

    const updated = await prisma.biocide.update({ where: { id }, data });
    res.json({ message: "Güncellendi", biocide: updated });
  } catch (e) {
    if (e?.code === "P2025") return res.status(404).json({ message: "Kayıt bulunamadı" });
    if (e?.code === "P2002") return res.status(409).json({ message: "Aynı kayıt mevcut" });
    console.error("PUT /biocides/:id", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/* Silme:
   - Admin + Employee */
router.delete("/:id", auth, roleCheck(["admin","employee"]), async (req,res) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ message: "Geçersiz id" });
    await prisma.biocide.delete({ where: { id } });
    res.json({ message: "Silindi" });
  } catch (e) {
    if (e?.code === "P2025") return res.status(404).json({ message: "Kayıt bulunamadı" });
    console.error("DELETE /biocides/:id", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

export default router;
