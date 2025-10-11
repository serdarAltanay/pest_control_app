// routes/ek1.js
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { auth, roleCheck } from "../middleware/auth.js";

const prisma = new PrismaClient();
const router = Router();

/* ------------------------ helpers ------------------------ */
const toId = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const normalizeMethod = (m) => {
  if (!m) return m;
  const up = String(m).toUpperCase();
  // Şemada "PULVERİZE" var; FE zaman zaman "PULVERIZE" gönderebilir.
  if (up === "PULVERIZE") return "PULVERİZE";
  return up;
};

async function ensureProviderProfile() {
  // Model henüz generate edilmemişse 500 atmamak için güvenli dönüş
  if (!prisma.providerProfile || typeof prisma.providerProfile.findFirst !== "function") {
    return {
      companyName: "PESTAPP DEMO",
      address: "",
      responsibleTitle: "",
      responsibleName: "",
      phoneFax: "",
      certificateSerial: "",
      permissionNo: "",
    };
  }
  let p = await prisma.providerProfile.findFirst();
  if (!p) {
    p = await prisma.providerProfile.create({ data: { companyName: "PEST QR DEMO" } });
  }
  return p;
}


async function ensureReport(visitId) {
  let report = await prisma.ek1Report.findUnique({ where: { visitId } });
  if (!report) {
    report = await prisma.ek1Report.create({
      data: { visitId, status: "DRAFT" },
    });
  }
  return report;
}

function computeStatusAfter(report) {
  const hasProvider = !!report.providerSignedAt;
  const hasCustomer = !!report.customerSignedAt;
  if (hasProvider && hasCustomer) return "APPROVED";
  if (hasProvider || hasCustomer) return "SUBMITTED";
  return report.status || "DRAFT";
}

/* ------------------ core data loaders -------------------- */
async function loadVisitBundle(visitId) {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: {
      store: { include: { customer: true } },
    },
  });
  if (!visit) return null;

  const [lines, report, provider] = await Promise.all([
    prisma.ek1Line.findMany({
      where: { visitId },
      include: { biosidal: true },
      orderBy: { id: "asc" },
    }),
    ensureReport(visitId),
    ensureProviderProfile(),
  ]);

  return {
    visit,
    store: visit.store,
    customer: visit.store?.customer || null,
    lines,
    report,
    provider,
  };
}

/* --------------------- handlers (reuse) ------------------ */
// GET bundle
async function hGetBundle(req, res) {
  try {
    const visitId = toId(req.params.visitId);
    if (!visitId) return res.status(400).json({ message: "Geçersiz visitId" });

    const bundle = await loadVisitBundle(visitId);
    if (!bundle) return res.status(404).json({ message: "Ziyaret bulunamadı" });
    res.json(bundle);
  } catch (e) {
    console.error("GET bundle", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
}

// GET lines
async function hListLines(req, res) {
  try {
    const visitId = toId(req.params.visitId);
    if (!visitId) return res.status(400).json({ message: "Geçersiz visitId" });

    const lines = await prisma.ek1Line.findMany({
      where: { visitId },
      include: { biosidal: true },
      orderBy: { id: "desc" },
    });
    res.json(lines);
  } catch (e) {
    console.error("GET lines", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
}

// POST line
async function hCreateLine(req, res) {
  try {
    const visitId = toId(req.params.visitId);
    const { biosidalId, method, amount } = req.body || {};
    if (!visitId || !biosidalId || !method || amount == null) {
      return res.status(400).json({ message: "Zorunlu alanlar eksik" });
    }

    // visit var mı
    const v = await prisma.visit.findUnique({ where: { id: visitId } });
    if (!v) return res.status(404).json({ message: "Ziyaret bulunamadı" });

    // biocide var mı
    const bio = await prisma.biocide.findUnique({ where: { id: Number(biosidalId) } });
    if (!bio) return res.status(404).json({ message: "Biyosidal ürün bulunamadı" });

    const line = await prisma.ek1Line.create({
      data: {
        visitId,
        biosidalId: Number(biosidalId),
        method: normalizeMethod(method),
        amount: Number(amount),
      },
    });
    res.json({ message: "Eklendi", line });
  } catch (e) {
    console.error("POST line", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
}

// DELETE line
async function hDeleteLine(req, res) {
  try {
    const lineId = toId(req.params.lineId);
    if (!lineId) return res.status(400).json({ message: "Geçersiz lineId" });
    await prisma.ek1Line.delete({ where: { id: lineId } });
    res.json({ message: "Silindi" });
  } catch (e) {
    console.error("DELETE line", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
}

// POST submit
async function hSubmit(req, res) {
  try {
    const visitId = toId(req.params.visitId);
    if (!visitId) return res.status(400).json({ message: "Geçersiz visitId" });
    await ensureReport(visitId);
    const report = await prisma.ek1Report.update({
      where: { visitId },
      data: { status: "SUBMITTED" },
    });
    res.json({ message: "Onaya gönderildi", report });
  } catch (e) {
    console.error("SUBMIT", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
}

// POST sign (provider / customer)
async function hSign(kind /* 'provider' | 'customer' */ , req, res) {
  try {
    const visitId = toId(req.params.visitId);
    if (!visitId) return res.status(400).json({ message: "Geçersiz visitId" });

    await ensureReport(visitId);
    const name =
      (req.body?.name || req.user?.fullName || req.user?.email || (kind === "provider" ? "Uygulayıcı" : "Müşteri")).toString();

    let data =
      kind === "provider"
        ? { providerSignedAt: new Date(), providerSignerName: name }
        : { customerSignedAt: new Date(), customerSignerName: name };

    let report = await prisma.ek1Report.update({ where: { visitId }, data });
    report = await prisma.ek1Report.update({
      where: { visitId },
      data: { status: computeStatusAfter(report) },
    });
    res.json(report);
  } catch (e) {
    console.error(`SIGN ${kind}`, e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
}

// POST approve
async function hApprove(req, res) {
  try {
    const visitId = toId(req.params.visitId);
    if (!visitId) return res.status(400).json({ message: "Geçersiz visitId" });
    await ensureReport(visitId);
    const report = await prisma.ek1Report.update({
      where: { visitId },
      data: { status: "APPROVED" },
    });
    res.json({ message: "Onaylandı", report });
  } catch (e) {
    console.error("APPROVE", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
}

// POST pdf
async function hPdf(req, res) {
  try {
    const visitId = toId(req.params.visitId);
    if (!visitId) return res.status(400).json({ message: "Geçersiz visitId" });

    const pdfUrl = `/files/ek1/${visitId}.pdf`; // gerçek üretim burada yapılır
    const report = await prisma.ek1Report.upsert({
      where: { visitId },
      update: { pdfUrl },
      create: { visitId, pdfUrl, status: "DRAFT" },
    });
    res.json({ message: "PDF hazırlandı", report });
  } catch (e) {
    console.error("PDF", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
}

/* --------------------- new endpoints --------------------- */
// Bundle
router.get(
  "/visit/:visitId",
  auth,
  roleCheck(["admin", "employee", "customer"]),
  hGetBundle
);

// Lines
router.get(
  "/visit/:visitId/lines",
  auth,
  roleCheck(["admin", "employee", "customer"]),
  hListLines
);
router.post(
  "/visit/:visitId/lines",
  auth,
  roleCheck(["admin", "employee"]),
  hCreateLine
);
router.delete(
  "/visit/:visitId/lines/:lineId",
  auth,
  roleCheck(["admin", "employee"]),
  hDeleteLine
);

// Submit
router.post(
  "/visit/:visitId/submit",
  auth,
  roleCheck(["admin", "employee"]),
  hSubmit
);

// Sign
router.post(
  "/visit/:visitId/sign/provider",
  auth,
  roleCheck(["admin", "employee"]),
  (req, res) => hSign("provider", req, res)
);
router.post(
  "/visit/:visitId/sign/customer",
  auth,
  roleCheck(["customer", "admin", "employee"]),
  (req, res) => hSign("customer", req, res)
);

// Approve & PDF
router.post(
  "/visit/:visitId/approve",
  auth,
  roleCheck(["admin"]),
  hApprove
);
router.post(
  "/visit/:visitId/pdf",
  auth,
  roleCheck(["admin", "employee"]),
  hPdf
);

/* -------------------- legacy aliases --------------------- */
/*  /visits/:visitId/ek1          → bundle
    /visits/:visitId/ek1/lines   → list/create
    /visits/:visitId/ek1/lines/:lineId → delete
    /visits/:visitId/ek1/submit  → submit
    /visits/:visitId/ek1/sign/provider|customer
    /visits/:visitId/ek1/approve → approve
    /visits/:visitId/ek1/pdf     → pdf
*/
const as = (path) => path.replace("/visits/", "/ek1/visit/").replace("/ek1", "");

router.get(
  "/visits/:visitId/ek1",
  auth,
  roleCheck(["admin", "employee", "customer"]),
  hGetBundle
);
router.get(
  "/visits/:visitId/ek1/lines",
  auth,
  roleCheck(["admin", "employee", "customer"]),
  hListLines
);
router.post(
  "/visits/:visitId/ek1/lines",
  auth,
  roleCheck(["admin", "employee"]),
  hCreateLine
);
router.delete(
  "/visits/:visitId/ek1/lines/:lineId",
  auth,
  roleCheck(["admin", "employee"]),
  hDeleteLine
);
router.post(
  "/visits/:visitId/ek1/submit",
  auth,
  roleCheck(["admin", "employee"]),
  hSubmit
);
router.post(
  "/visits/:visitId/ek1/sign/provider",
  auth,
  roleCheck(["admin", "employee"]),
  (req, res) => hSign("provider", req, res)
);
router.post(
  "/visits/:visitId/ek1/sign/customer",
  auth,
  roleCheck(["customer", "admin", "employee"]),
  (req, res) => hSign("customer", req, res)
);
router.post(
  "/visits/:visitId/ek1/approve",
  auth,
  roleCheck(["admin"]),
  hApprove
);
router.post(
  "/visits/:visitId/ek1/pdf",
  auth,
  roleCheck(["admin", "employee"]),
  hPdf
);

export default router;
