// routes/ek1.js
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { auth, roleCheck } from "../middleware/auth.js";

const prisma = new PrismaClient();
const router = Router();

/* ───────── helpers ───────── */
const toId = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const normalizeMethod = (m) => {
  if (!m) return m;
  const up = String(m).toUpperCase();
  if (up === "PULVERIZE") return "PULVERİZE";
  return up;
};

async function ensureProviderProfile() {
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
  if (!p) p = await prisma.providerProfile.create({ data: { companyName: "PEST QR DEMO" } });
  return p;
}

async function ensureReport(visitId) {
  let report = await prisma.ek1Report.findUnique({ where: { visitId } });
  if (!report) report = await prisma.ek1Report.create({ data: { visitId, status: "DRAFT" } });
  return report;
}

function computeStatusAfter(report) {
  const hasProvider = !!report.providerSignedAt;
  const hasCustomer = !!report.customerSignedAt;
  if (hasProvider && hasCustomer) return "APPROVED";
  if (hasProvider || hasCustomer) return "SUBMITTED";
  return report.status || "DRAFT";
}

/* ───────── loaders ───────── */
async function loadVisitBundle(visitId) {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: { store: { include: { customer: true } } },
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

  // Serbest EK-1 meta’sından görsel isimleri türet
  const meta = report?.freeMeta || null;

  let store = visit.store || null;
  if ((!store || !store.name) && meta) {
    store = {
      id: null,
      name: meta.storeName || "—",
      address: meta.address || "",
      placeType: meta.placeType || "",
      areaM2: meta.areaM2 ?? null,
      customer: null,
    };
  }

  let customer = store?.customer || null;
  if ((!customer || !customer.title) && meta) {
    customer = {
      id: null,
      title: meta.customerTitle || "—",
      email: meta.customerEmail || null,
      contactFullName: meta.customerContactName || null,
    };
  }

  return { visit, store, customer, lines, report, provider };
}

/* ───────── handlers ───────── */
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

async function hCreateLine(req, res) {
  try {
    const visitId = toId(req.params.visitId);
    const { biosidalId, method, amount } = req.body || {};
    if (!visitId || !biosidalId || !method || amount == null) {
      return res.status(400).json({ message: "Zorunlu alanlar eksik" });
    }
    const v = await prisma.visit.findUnique({ where: { id: visitId } });
    if (!v) return res.status(404).json({ message: "Ziyaret bulunamadı" });

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

async function hSign(kind, req, res) {
  try {
    const visitId = toId(req.params.visitId);
    if (!visitId) return res.status(400).json({ message: "Geçersiz visitId" });

    await ensureReport(visitId);
    const name =
      (req.body?.name || req.user?.fullName || req.user?.email || (kind === "provider" ? "Uygulayıcı" : "Müşteri")).toString();

    const data =
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

async function hPdf(req, res) {
  try {
    const visitId = toId(req.params.visitId);
    if (!visitId) return res.status(400).json({ message: "Geçersiz visitId" });

    const pdfUrl = `/files/ek1/${visitId}.pdf`;
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

/* ───────── FREE container store ───────── */
async function ensureFreeContainerStore() {
  // 1) [FREE] SERBEST müşteri (code required ise doldur)
  let cust = await prisma.customer.findFirst({ where: { code: "FREE" } });
  if (!cust) {
    cust = await prisma.customer.create({
      data: {
        code: "FREE",
        title: "[FREE] SERBEST",
      },
    });
  }

  // 2) [FREE] SERBEST (CONTAINER) mağazası
  let store = await prisma.store.findFirst({ where: { code: "FREE-CONTAINER" } });
  if (!store) {
    store = await prisma.store.create({
      data: {
        code: "FREE-CONTAINER",
        name: "[FREE] SERBEST (CONTAINER)",
        address: "",
        // placeType enum’uyla çatışmayı önlemek için değer vermiyoruz
        customerId: cust.id,
      },
    });
  }

  return store;
}

/* ───────── FREE EK-1 create ───────── */
/**
 * POST /api/ek1/free
 * Flat ve nested payload (freeCustomer/freeStore/visit) + ncrs (görselsiz) destekler.
 */
async function hCreateFreeEk1(req, res) {
  try {
    const b = req.body || {};

    // flat veya nested payload
    const customerTitle = b.customerTitle ?? b.freeCustomer?.title ?? "";
    const customerContactName = b.customerContactName ?? b.freeCustomer?.contactName ?? null;
    const customerEmail = b.customerEmail ?? b.freeCustomer?.email ?? null;
    const customerPhone = b.customerPhone ?? b.freeCustomer?.phone ?? null;

    const storeName = b.storeName ?? b.freeStore?.name ?? "";
    const address = b.address ?? b.freeStore?.address ?? "";
    const placeType = b.placeType ?? b.freeStore?.placeType ?? null;
    const areaM2 = b.areaM2 ?? b.freeStore?.areaM2 ?? null;

    const date = b.date ?? b.visit?.date ?? null;
    const startTime = b.startTime ?? b.visit?.startTime ?? null;
    const endTime = b.endTime ?? b.visit?.endTime ?? null;
    const visitTypeRequested = b.visitType ?? b.visit?.visitType ?? "TEK_SEFERLIK";
    const targetPests = b.targetPests ?? b.visit?.targetPests ?? null;
    const notes = b.notes ?? b.visit?.notes ?? null;
    const employees = b.employees ?? b.visit?.employees ?? null;

    const lines = Array.isArray(b.lines) ? b.lines : [];
    const ncrsRaw = Array.isArray(b.ncrs) ? b.ncrs : [];

    if (!customerTitle || !storeName || !date) {
      return res.status(400).json({ message: "customerTitle, storeName ve date zorunludur" });
    }

    // FK zorunluluğu için container store kullan
    const freeStore = await ensureFreeContainerStore();

    const visit = await prisma.visit.create({
      data: {
        storeId: freeStore.id,
        date: new Date(date),
        startTime: startTime ?? null,
        endTime: endTime ?? null,
        visitType: "DIGER", // enum güvenli değeri
        targetPests: targetPests ?? null,
        notes: notes ?? null,
        employees: employees ?? null,
      },
    });

    // NCR’ları sanitize et (görselsiz)
    const ncrs = ncrsRaw
      .map((n) => ({
        title: (n?.title || "").toString().trim(),
        notes: (n?.notes || "").toString().trim(),
        observedAt: n?.observedAt ? new Date(n.observedAt) : null,
      }))
      .filter((n) => n.title || n.notes);

    // free meta + otomatik müşteri onayı
    const freeMeta = {
      type: "FREE",
      visitKind: "TEK_SEFERLIK",
      requestedVisitType: visitTypeRequested,
      customerTitle,
      customerContactName: customerContactName || null,
      customerEmail: customerEmail || null,
      customerPhone: customerPhone || null,
      storeName,
      address: address || null,
      placeType: placeType || null,
      areaM2: areaM2 ?? null,
      ncrs, // ← serbest uygunsuzluklar
    };

    await prisma.ek1Report.create({
      data: {
        visitId: visit.id,
        status: "SUBMITTED",
        customerSignedAt: new Date(),
        customerSignerName: customerContactName || customerTitle,
        freeMeta,
      },
    });

    // Ürün satırları
    if (lines.length > 0) {
      await Promise.all(
        lines.map((l) => {
          const bid = Number(l.biosidalId);
          if (!bid || l.amount == null || !l.method) return null;
          return prisma.ek1Line.create({
            data: {
              visitId: visit.id,
              biosidalId: bid,
              method: normalizeMethod(l.method),
              amount: Number(l.amount),
            },
          });
        })
      );
    }

    return res.status(201).json({ message: "Serbest EK-1 oluşturuldu", visitId: visit.id });
  } catch (e) {
    console.error("POST /ek1/free", e);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
}

/* ───────── list & misc ───────── */
async function hListEk1(req, res) {
  try {
    const list = await prisma.ek1Report.findMany({
      include: { visit: { include: { store: { include: { customer: true } } } } },
      orderBy: [{ updatedAt: "desc" }, { visitId: "desc" }],
    });

    const mapped = list.map((r) => {
      const v = r.visit || {};
      const st = v.store || {};
      const cust = st.customer || {};
      const meta = r.freeMeta || {};

      const customerName = cust.name || cust.fullName || cust.title || meta.customerTitle || "-";
      const storeName = st.name || meta.storeName || (v.storeId ? `Mağaza #${v.storeId}` : "-");

      return {
        id: r.visitId,
        title: `Ziyaret #${r.visitId}`,
        customerName,
        storeName,
        storeId: v.storeId || st.id || null,
        employeeName: null,
        employeeId: null,
        status: r.status || "DRAFT",
        createdAt: v.createdAt || r.createdAt || null,
        start: v.date || null,
        fileUrl: r.pdfUrl || null,
        pdfUrl: r.pdfUrl || null,
        isFree: !!r.freeMeta,
      };
    });

    mapped.sort((a, b) => {
      const A = a.createdAt ? new Date(a.createdAt).getTime() : (a.start ? new Date(a.start).getTime() : 0);
      const B = b.createdAt ? new Date(b.createdAt).getTime() : (b.start ? new Date(b.start).getTime() : 0);
      return B - A;
    });

    res.json(mapped);
  } catch (e) {
    console.error("LIST EK1", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
}

async function hSignAuto(req, res) {
  const role = (req.user?.role || "").toLowerCase();
  if (role === "admin" || role === "employee") return hSign("provider", req, res);
  if (role === "customer") return hSign("customer", req, res);
  return res.status(403).json({ message: "Yetkiniz yok" });
}

async function hSendEmail(req, res) {
  try {
    const visitId = toId(req.params.visitId);
    if (!visitId) return res.status(400).json({ message: "Geçersiz visitId" });
    const email = String(req.body?.email || "").trim();
    if (!email) return res.status(400).json({ message: "E-posta gerekli" });
    await ensureReport(visitId);
    res.json({ message: "E-posta kuyruğa alındı", email, visitId });
  } catch (e) {
    console.error("SEND EMAIL", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
}

/* ───────── routes ───────── */
// FREE (Serbest) EK-1
router.post("/free", auth, roleCheck(["admin", "employee"]), hCreateFreeEk1);

// LIST
router.get("/", auth, roleCheck(["admin", "employee", "customer"]), hListEk1);

// Bundle
router.get("/visit/:visitId", auth, roleCheck(["admin", "employee", "customer"]), hGetBundle);

// Lines
router.get("/visit/:visitId/lines", auth, roleCheck(["admin", "employee", "customer"]), hListLines);
router.post("/visit/:visitId/lines", auth, roleCheck(["admin", "employee"]), hCreateLine);
router.delete("/visit/:visitId/lines/:lineId", auth, roleCheck(["admin", "employee"]), hDeleteLine);

// Submit
router.post("/visit/:visitId/submit", auth, roleCheck(["admin", "employee"]), hSubmit);

// Sign
router.post("/visit/:visitId/sign/provider", auth, roleCheck(["admin", "employee"]), (req, res) => hSign("provider", req, res));
router.post("/visit/:visitId/sign/customer", auth, roleCheck(["customer", "admin", "employee"]), (req, res) => hSign("customer", req, res));
router.post("/:visitId/sign", auth, roleCheck(["admin", "employee", "customer"]), hSignAuto);

// Approve & PDF (+ alias)
router.post("/visit/:visitId/approve", auth, roleCheck(["admin"]), hApprove);
router.post("/visit/:visitId/pdf", auth, roleCheck(["admin", "employee"]), hPdf);
router.post("/:visitId/pdf", auth, roleCheck(["admin", "employee"]), hPdf);

// Send email (stub)
router.post("/:visitId/send-email", auth, roleCheck(["admin", "employee"]), hSendEmail);

/* legacy aliases */
router.get("/visits/:visitId/ek1", auth, roleCheck(["admin", "employee", "customer"]), hGetBundle);
router.get("/visits/:visitId/ek1/lines", auth, roleCheck(["admin", "employee", "customer"]), hListLines);
router.post("/visits/:visitId/ek1/lines", auth, roleCheck(["admin", "employee"]), hCreateLine);
router.delete("/visits/:visitId/ek1/lines/:lineId", auth, roleCheck(["admin", "employee"]), hDeleteLine);
router.post("/visits/:visitId/ek1/submit", auth, roleCheck(["admin", "employee"]), hSubmit);
router.post("/visits/:visitId/ek1/sign/provider", auth, roleCheck(["admin", "employee"]), (req, res) => hSign("provider", req, res));
router.post("/visits/:visitId/ek1/sign/customer", auth, roleCheck(["customer", "admin", "employee"]), (req, res) => hSign("customer", req, res));
router.post("/visits/:visitId/ek1/approve", auth, roleCheck(["admin"]), hApprove);
router.post("/visits/:visitId/ek1/pdf", auth, roleCheck(["admin", "employee"]), hPdf);

export default router;
