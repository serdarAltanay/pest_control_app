import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { auth, roleCheck } from "../middleware/auth.js";

const prisma = new PrismaClient();
const router = Router();

const UNIT_VALUES = ["ML","GR","LT","KG","ADET"];

router.get("/", auth, roleCheck(["admin","employee"]), async (req,res) => {
  try {
    const rows = await prisma.biocide.findMany({ orderBy: { name: "asc" } });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

router.post("/", auth, roleCheck(["admin"]), async (req,res) => {
  try {
    const { name, activeIngredient, antidote, unit } = req.body;
    if (!name || !activeIngredient || !antidote || !unit) {
      return res.status(400).json({ message: "name, activeIngredient, antidote, unit zorunlu."});
    }
    if (!UNIT_VALUES.includes(unit)) return res.status(400).json({ message: "Geçersiz unit" });

    const created = await prisma.biocide.create({
      data: { name: String(name).trim(), activeIngredient, antidote, unit }
    });
    res.json({ message: "Biyosidal eklendi", biocide: created });
  } catch (e) {
    if (e.code === "P2002") return res.status(409).json({ message: "Bu biyosidal zaten var." });
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

router.put("/:id", auth, roleCheck(["admin"]), async (req,res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Geçersiz id" });

    const data = {};
    if ("name" in req.body) data.name = String(req.body.name).trim();
    if ("activeIngredient" in req.body) data.activeIngredient = String(req.body.activeIngredient);
    if ("antidote" in req.body) data.antidote = String(req.body.antidote);
    if ("unit" in req.body) {
      if (!UNIT_VALUES.includes(req.body.unit)) return res.status(400).json({ message: "Geçersiz unit" });
      data.unit = req.body.unit;
    }

    const updated = await prisma.biocide.update({ where: { id }, data });
    res.json({ message: "Güncellendi", biocide: updated });
  } catch (e) {
    if (e.code === "P2025") return res.status(404).json({ message: "Kayıt bulunamadı" });
    if (e.code === "P2002") return res.status(409).json({ message: "Aynı kayıt mevcut" });
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

router.delete("/:id", auth, roleCheck(["admin"]), async (req,res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Geçersiz id" });
    await prisma.biocide.delete({ where: { id } });
    res.json({ message: "Silindi" });
  } catch (e) {
    if (e.code === "P2025") return res.status(404).json({ message: "Kayıt bulunamadı" });
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

export default router;
