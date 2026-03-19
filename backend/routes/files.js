import express from "express";
import { PrismaClient } from "@prisma/client";
import { auth } from "../middleware/auth.js";

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/files/:id
router.get("/:id", auth, async (req, res) => {
    try {
        const file = await prisma.fileStorage.findUnique({
            where: { id: req.params.id }
        });
        
        if (!file) {
            return res.status(404).json({ message: "Dosya veritabanında bulunamadı." });
        }

        if (file.mime) {
            res.setHeader("Content-Type", file.mime);
        }
        res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.filename)}"`);
        
        return res.send(file.data);
    } catch (e) {
        console.error("GET /files/:id error:", e);
        res.status(500).json({ message: "Sunucu hatası" });
    }
});

export default router;
