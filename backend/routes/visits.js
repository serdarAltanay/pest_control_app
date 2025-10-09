import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { auth, roleCheck } from "../middleware/auth.js";

const prisma = new PrismaClient();
const router = Router();

const parseId = (v)=>{ const n=Number(v); return Number.isFinite(n)&&n>0 ? n : null; };

// LIST by store
router.get("/store/:storeId", auth, roleCheck(["admin","employee"]), async (req,res)=>{
  const storeId = parseId(req.params.storeId);
  if(!storeId) return res.status(400).json({message:"Geçersiz storeId"});
  const items = await prisma.visit.findMany({
    where:{ storeId }, orderBy:{ date:"desc" }
  });
  res.json(items);
});

// GET one
router.get("/:id", auth, roleCheck(["admin","employee"]), async (req,res)=>{
  const id = parseId(req.params.id);
  if(!id) return res.status(400).json({message:"Geçersiz id"});
  const v = await prisma.visit.findUnique({ where:{ id }, include:{ ek1:true }});
  if(!v) return res.status(404).json({message:"Bulunamadı"});
  res.json(v);
});

// CREATE
router.post("/", auth, roleCheck(["admin","employee"]), async (req,res)=>{
  const { storeId, date, startTime, endTime, visitType, targetPests, notes, employees } = req.body;
  const sid = parseId(storeId);
  if(!sid || !date || !visitType) return res.status(400).json({message:"storeId, date, visitType zorunlu"});
  const visit = await prisma.visit.create({
    data:{
      storeId:sid,
      date:new Date(date),
      startTime:startTime ?? null,
      endTime:endTime ?? null,
      visitType,
      targetPests: targetPests ?? null,
      notes: notes ?? null,
      employees: employees ?? null,
      ek1:{ create:{} } // DRAFT
    },
    include:{ ek1:true }
  });
  res.json({ message:"Ziyaret oluşturuldu", visit });
});

// UPDATE
router.put("/:id", auth, roleCheck(["admin","employee"]), async (req,res)=>{
  const id = parseId(req.params.id);
  if(!id) return res.status(400).json({message:"Geçersiz id"});
  const data = {};
  ["date","startTime","endTime","visitType","targetPests","notes","employees"].forEach(k=>{
    if(k in req.body) data[k] = k==="date" ? new Date(req.body[k]) : req.body[k];
  });
  const visit = await prisma.visit.update({ where:{ id }, data });
  res.json({ message:"Güncellendi", visit });
});

// DELETE
router.delete("/:id", auth, roleCheck(["admin"]), async (req,res)=>{
  const id = parseId(req.params.id);
  await prisma.visit.delete({ where:{ id }});
  res.json({message:"Silindi"});
});

export default router;
