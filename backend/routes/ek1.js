// routes/ek1.js
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { auth, roleCheck } from "../middleware/auth.js";

const prisma = new PrismaClient();
const router = Router();

/* ───────── helpers ───────── */
const toId = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };
const normalizeMethod = (m) => { if (!m) return m; const up = String(m).toUpperCase(); return up === "PULVERIZE" ? "PULVERİZE" : up; };

/* ───────── ACCESS SCOPE (müşteri hangi mağazalara erişir?) ─────────
   Not: FE’de “customer” rolü, gerçekte AccessOwner kullanıcısını temsil eder. */
async function getAccessibleStoreIdsForCustomer(prisma, user) {
  const storeIds = new Set();

  // 0) NEW PATH: AccessOwner → AccessGrant (öncelik)
  let ownerId = Number(
    user?.accessOwnerId ??
    user?.ownerId ??
    ((user?.role || "").toLowerCase() === "customer" ? user?.id : null)
  );

  if ((!Number.isFinite(ownerId) || ownerId <= 0) && prisma.accessOwner?.findUnique) {
    const email = (user?.email || "").trim().toLowerCase();
    if (email) {
      const owner = await prisma.accessOwner.findUnique({ where: { email }, select: { id: true } });
      if (owner?.id) ownerId = owner.id;
    }
  }

  if (Number.isFinite(ownerId) && ownerId > 0 && prisma.accessGrant?.findMany) {
    const grants = await prisma.accessGrant.findMany({
      where: { ownerId },
      select: { scopeType: true, customerId: true, storeId: true },
    });
    if (grants.length) {
      const customerIds = [];
      for (const g of grants) {
        if (g.scopeType === "STORE" && g.storeId) storeIds.add(g.storeId);
        if (g.scopeType === "CUSTOMER" && g.customerId) customerIds.push(g.customerId);
      }
      if (customerIds.length) {
        const stores = await prisma.store.findMany({ where: { customerId: { in: customerIds } }, select: { id: true } });
        stores.forEach(s => storeIds.add(s.id));
      }
    }
  }

  // 1) BACK-COMPAT: customerMembership
  const uid = Number(user?.id ?? user?.userId);
  if (prisma.customerMembership?.findMany && Number.isFinite(uid)) {
    const mems = await prisma.customerMembership.findMany({
      where: { userId: uid, isEnabled: true },
      select: { storeId: true, customerId: true },
    });
    const orgCustomerIds = mems.filter(m => !m.storeId && m.customerId).map(m => m.customerId);
    const explicitStoreIds = mems.filter(m => m.storeId).map(m => m.storeId);
    explicitStoreIds.forEach(id => storeIds.add(id));
    if (orgCustomerIds.length) {
      const stores = await prisma.store.findMany({ where: { customerId: { in: orgCustomerIds } }, select: { id: true } });
      stores.forEach(s => storeIds.add(s.id));
    }
  }

  // 2) BACK-COMPAT: customerUser
  if (prisma.customerUser?.findUnique && Number.isFinite(uid)) {
    const cu = await prisma.customerUser.findUnique({
      where: { id: uid },
      select: { customerId: true, storeId: true },
    });
    if (cu?.storeId) storeIds.add(cu.storeId);
    if (cu?.customerId) {
      const stores = await prisma.store.findMany({
        where: { customerId: cu.customerId },
        select: { id: true },
      });
      stores.forEach(s => storeIds.add(s.id));
    }
  }

  // 3) BACK-COMPAT: token içeriği
  if (Array.isArray(user?.storeIds)) {
    user.storeIds.forEach((x) => Number.isFinite(Number(x)) && storeIds.add(Number(x)));
  }
  if (user?.customerId && !storeIds.size) {
    const stores = await prisma.store.findMany({
      where: { customerId: Number(user.customerId) },
      select: { id: true },
    });
    stores.forEach(s => storeIds.add(s.id));
  }

  return Array.from(storeIds);
}

/* ───────── provider/report yardımcıları ───────── */
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

/* ───────── müşteri erişim guard ───────── */
async function assertCustomerCanSeeVisit(req, visitId) {
  const role = (req.user?.role || "").toLowerCase();
  if (role !== "customer") return true;
  const v = await prisma.visit.findUnique({ where: { id: visitId }, select: { storeId: true } });
  if (!v) return false;
  const allowed = await getAccessibleStoreIdsForCustomer(prisma, req.user);
  return allowed.includes(v.storeId);
}

/* ───────── FREE container store ───────── */
async function ensureFreeContainerStore() {
  let cust = await prisma.customer.findFirst({ where: { code: "FREE" } });
  if (!cust) {
    cust = await prisma.customer.create({
      data: { code: "FREE", title: "[FREE] SERBEST" },
    });
  }
  let store = await prisma.store.findFirst({ where: { code: "FREE-CONTAINER" } });
  if (!store) {
    store = await prisma.store.create({
      data: {
        code: "FREE-CONTAINER",
        name: "[FREE] SERBEST (CONTAINER)",
        address: "",
        customerId: cust.id,
      },
    });
  }
  return store;
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

    if ((req.user?.role || "").toLowerCase() === "customer") {
      const ok = await assertCustomerCanSeeVisit(req, visitId);
      if (!ok) return res.status(403).json({ message: "Yetkiniz yok" });
    }

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

    if ((req.user?.role || "").toLowerCase() === "customer") {
      const ok = await assertCustomerCanSeeVisit(req, visitId);
      if (!ok) return res.status(403).json({ message: "Yetkiniz yok" });
    }

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
    const v = await prisma.visit.findUnique({ where: { id: visitId }, select: { id: true } });
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

    if ((req.user?.role || "").toLowerCase() === "customer") {
      const ok = await assertCustomerCanSeeVisit(req, visitId);
      if (!ok) return res.status(403).json({ message: "Yetkiniz yok" });
    }

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

async function hSignAuto(req, res) {
  const role = (req.user?.role || "").toLowerCase();
  if (role === "admin" || role === "employee") return hSign("provider", req, res);
  if (role === "customer") return hSign("customer", req, res);
  return res.status(403).json({ message: "Yetkiniz yok" });
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

async function hSendEmail(req, res) {
  try {
    const visitId = toId(req.params.visitId);
    if (!visitId) return res.status(400).json({ message: "Geçersiz visitId" });
    const email = String(req.body?.email || "").trim();
    if (!email) return res.status(400).json({ message: "E-posta gerekli" });
    await ensureReport(visitId);
    // gerçek e-posta kuyruğu entegrasyonu burada yapılabilir
    res.json({ message: "E-posta kuyruğa alındı", email, visitId });
  } catch (e) {
    console.error("SEND EMAIL", e);
    res.status(500).json({ message: "Sunucu hatası" });
  }
}

async function hCreateFreeEk1(req, res) {
  try {
    const b = req.body || {};

    // flat veya nested payload desteği
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

    const freeStore = await ensureFreeContainerStore();

    const visit = await prisma.visit.create({
      data: {
        storeId: freeStore.id,
        date: new Date(date),
        startTime: startTime ?? null,
        endTime: endTime ?? null,
        visitType: "DIGER",
        targetPests: targetPests ?? null,
        notes: notes ?? null,
        employees: employees ?? null,
      },
    });

    const ncrs = ncrsRaw
      .map((n) => ({
        title: (n?.title || "").toString().trim(),
        notes: (n?.notes || "").toString().trim(),
        observedAt: n?.observedAt ? new Date(n.observedAt) : null,
      }))
      .filter((n) => n.title || n.notes);

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
      ncrs,
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

async function hListEk1(req, res) {
  try {
    const role = (req.user?.role || "").toLowerCase();

    let where = {};
    if (role === "customer") {
      const allowedStoreIds = await getAccessibleStoreIdsForCustomer(prisma, req.user);
      if (!allowedStoreIds.length) return res.json([]);
      where = { visit: { storeId: { in: allowedStoreIds } } };
    }

    const list = await prisma.ek1Report.findMany({
      where,
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
        providerSignedAt: r.providerSignedAt || null,
        customerSignedAt: r.customerSignedAt || null,
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

/* ───────── routes ───────── */
// FREE (Serbest) EK-1
router.post("/free", auth, roleCheck(["admin", "employee"]), hCreateFreeEk1);

// LIST
router.get("/", auth, roleCheck(["admin", "employee", "customer"]), hListEk1);

// Bundle & Lines
router.get("/visit/:visitId", auth, roleCheck(["admin", "employee", "customer"]), hGetBundle);
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

// Legacy aliases
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
