import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { auth, roleCheck } from "../middleware/auth.js";

const prisma = new PrismaClient();
const router = Router();
const parseId = v=>{ const n=Number(v); return Number.isFinite(n)&&n>0?n:null; };

// LIST biosidal lines for a visit
router.get("/:visitId/lines", auth, roleCheck(["admin","employee"]), async (req,res)=>{
  const vid = parseId(req.params.visitId);
  const lines = await prisma.ek1Line.findMany({
    where:{ visitId:vid }, include:{ biosidal:true }, orderBy:{ id:"asc" }
  });
  res.json(lines);
});

// ADD line
router.post("/:visitId/lines", auth, roleCheck(["admin","employee"]), async (req,res)=>{
  const vid = parseId(req.params.visitId);
  const { biosidalId, method, amount } = req.body;
  if(!vid || !biosidalId || !method || !amount) return res.status(400).json({message:"Zorunlu alanlar eksik"});
  const line = await prisma.ek1Line.create({ data:{ visitId:vid, biosidalId:Number(biosidalId), method, amount:Number(amount) }});
  res.json({ message:"Eklendi", line });
});

// DELETE line
router.delete("/lines/:id", auth, roleCheck(["admin","employee"]), async (req,res)=>{
  await prisma.ek1Line.delete({ where:{ id:Number(req.params.id) }});
  res.json({message:"Silindi"});
});

// SUBMIT (onaya gönder)
router.post("/:visitId/submit", auth, roleCheck(["admin","employee"]), async (req,res)=>{
  const vid = parseId(req.params.visitId);
  const ek1 = await prisma.ek1Report.update({
    where:{ visitId:vid }, data:{ status:"SUBMITTED" }
  });
  res.json({ message:"Onaya gönderildi", ek1 });
});

// (Opsiyonel) PDF üret – basit HTML'yi PDF'e çeviren bir servis kullanıyorsan burada çağır.
// Şimdilik sade HTML döndürüyoruz (frontend print ile PDF alabilir).
router.get("/:visitId/preview", auth, roleCheck(["admin","employee"]), async (req,res)=>{
  const vid = parseId(req.params.visitId);
  const visit = await prisma.visit.findUnique({
    where:{ id:vid },
    include:{ ek1:true, ek1Lines:{ include:{ biosidal:true }} , store:true }
  });
  if(!visit) return res.status(404).send("Bulunamadı");

  const rows = visit.ek1Lines.map((l,i)=>`
    <tr>
      <td>${i+1}</td>
      <td>${l.biosidal.name}</td>
      <td>${l.biosidal.activeIngredient ?? "-"}</td>
      <td>${l.biosidal.antidote ?? "-"}</td>
      <td>${l.method}</td>
      <td>${l.amount} ${l.biosidal.unit ?? ""}</td>
    </tr>`).join("");

  res.send(`
    <html>
    <head><meta charset="utf-8"><title>EK-1</title>
      <style>
        body{font-family:Arial; font-size:12px; margin:24px;}
        table{width:100%; border-collapse:collapse;}
        th,td{border:1px solid #444; padding:6px;}
        h2{margin:0 0 12px;}
      </style>
    </head>
    <body>
      <h2>EK-1 Biyosidal Uygulama İşlem Formu</h2>
      <table>
        <tr><th>Uygulama Yapılan Yer</th><td>${visit.store.name}</td></tr>
        <tr><th>Tarih / Saat</th><td>${new Date(visit.date).toLocaleDateString("tr-TR")} ${visit.startTime ?? ""} - ${visit.endTime ?? ""}</td></tr>
        <tr><th>Ziyaret Tipi</th><td>${visit.visitType}</td></tr>
        <tr><th>Hedef Zararlı</th><td>${(visit.targetPests ?? []).join(", ")}</td></tr>
      </table>
      <br/>
      <table>
        <thead>
          <tr><th>#</th><th>Ürün</th><th>Aktif Madde</th><th>Antidot</th><th>Uyg. Şekli</th><th>Miktar</th></tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="6">Biyosidal eklenmemiş</td></tr>`}</tbody>
      </table>
      <br/><button onclick="window.print()">YAZDIR</button>
    </body></html>
  `);
});

export default router;
