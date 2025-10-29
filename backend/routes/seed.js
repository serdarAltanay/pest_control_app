// routes/seed.js
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { auth, roleCheck } from "../middleware/auth.js";

const router = Router();
const prisma = new PrismaClient();

/** ------------ Şehir merkezleri (yaklaşık koordinatlar) ------------- */
const CITY_COORDS = {
  "İSTANBUL": [41.0151, 28.9795],
  "ANKARA":   [39.9208, 32.8541],
  "İZMİR":    [38.4237, 27.1428],
  "AYDIN":    [37.8450, 27.8390],
  "KOCAELİ":  [40.8533, 29.8815],
  "KOCAELI":  [40.8533, 29.8815],
  "TÜRKİYE":  [39.0, 35.0],
  "":         [39.0, 35.0],
};

/** ------------------------------- Helpers ---------------------------- */
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[randInt(0, arr.length - 1)];

function addMeters(lat, lng, dxMeters, dyMeters) {
  const dLat = dyMeters / 111_111;
  const dLng = dxMeters / (111_111 * Math.cos((lat * Math.PI) / 180));
  return [lat + dLat, lng + dLng];
}
function jitterAround(lat, lng, maxMeters = 1200) {
  const dx = (Math.random() * 2 - 1) * maxMeters;
  const dy = (Math.random() * 2 - 1) * maxMeters;
  return addMeters(lat, lng, dx, dy);
}

const StationTypes = [
  "FARE_YEMLEME",
  "CANLI_YAKALAMA",
  "ELEKTRIKLI_SINEK_TUTUCU",
  "BOCEK_MONITOR",
  "GUVE_TUZAGI",
];

const RiskLevels = ["RISK_YOK", "DUSUK", "ORTA", "YUKSEK"];

const VisitTypes = [
  "PERIYODIK",
  "ACIL_CAGRI",
  "ISTASYON_KURULUM",
  "ILK_ZIYARET",
  "DIGER",
];

const PestTypes = ["KEMIRGEN", "HACCADI", "UCAN", "BELIRTILMEDI"];
const PlaceTypes = ["OFIS", "DEPO", "MAGAZA", "FABRIKA", "BELIRTILMEDI"];
const VisitPeriods = ["HAFTALIK", "IKIHAFTALIK", "AYLIK", "IKIAYLIK", "UCAYLIK", "BELIRTILMEDI"];

const AppMethods = ["ULV", "PUSKURTME", "JEL", "SISLEME", "YENILEME", "ATOMIZER", "YEMLEME", "PULVERİZE"];

/** Aktivasyon payload’ı (istasyon tipine uygun) */
function makeActivationPayload(type) {
  const base = {
    aktiviteVar: Math.random() < 0.45,
    risk: pick(RiskLevels),
    notes: Math.random() < 0.22 ? "Rutin kontrol yapıldı." : null,
  };

  if (type === "FARE_YEMLEME") {
    Object.assign(base, {
      deformeYem: Math.random() < 0.10,
      yemDegisti: Math.random() < 0.25,
      deformeMonitor: Math.random() < 0.05,
      monitorDegisti: Math.random() < 0.20,
      ulasilamayanMonitor: Math.random() < 0.05,
    });
  } else if (type === "CANLI_YAKALAMA") {
    Object.assign(base, {
      deformeMonitor: Math.random() < 0.05,
      yapiskanDegisti: Math.random() < 0.20,
      monitorDegisti: Math.random() < 0.15,
      ulasilamayanMonitor: Math.random() < 0.05,
    });
  } else if (type === "ELEKTRIKLI_SINEK_TUTUCU") {
    Object.assign(base, {
      sariBantDegisim: Math.random() < 0.30,
      arizaliEFK: Math.random() < 0.05,
      tamirdeEFK: Math.random() < 0.02,
      uvLambaDegisim: Math.random() < 0.20,
      uvLambaAriza: Math.random() < 0.05,
      ulasilamayanMonitor: Math.random() < 0.05,
      karasinek: randInt(0, 6),
      sivrisinek: randInt(0, 3),
      diger: randInt(0, 2),
    });
  } else if (type === "BOCEK_MONITOR") {
    Object.assign(base, {
      monitorDegisti: Math.random() < 0.20,
      hedefZararliSayisi: randInt(0, 10),
    });
  } else if (type === "GUVE_TUZAGI") {
    Object.assign(base, {
      feromonDegisti: Math.random() < 0.20,
      deformeTuzak: Math.random() < 0.05,
      tuzakDegisti: Math.random() < 0.15,
      ulasilamayanTuzak: Math.random() < 0.05,
      guve: randInt(0, 4),
      diger: randInt(0, 2),
    });
  }

  if (base.aktiviteVar === undefined) {
    const anyCount =
      (base.karasinek || 0) + (base.sivrisinek || 0) + (base.diger || 0) +
      (base.guve || 0) + (base.hedefZararliSayisi || 0);
    if (anyCount > 0) base.aktiviteVar = true;
  }

  return base;
}

/** 7 günlük çalışan rotası */
async function seedTracksForEmployee(empId, baseLat, baseLng) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 7);
  const end = new Date();

  await prisma.employeeTrackPoint.deleteMany({
    where: { employeeId: empId, at: { gte: start, lte: end } },
  });

  const batch = [];
  for (let d = 0; d < 7; d++) {
    const day = new Date();
    day.setDate(day.getDate() - d);
    day.setHours(9, 0, 0, 0);

    let [lat, lng] = jitterAround(baseLat, baseLng, 500);
    const steps = randInt(18, 30);
    for (let i = 0; i < steps; i++) {
      day.setMinutes(day.getMinutes() + 10);
      const dx = randInt(120, 420) * (Math.random() > 0.5 ? 1 : -1);
      const dy = randInt(120, 420) * (Math.random() > 0.5 ? 1 : -1);
      [lat, lng] = addMeters(lat, lng, dx, dy);

      batch.push({
        employeeId: empId,
        lat, lng,
        accuracy: randInt(5, 25),
        speed: null,
        heading: null,
        source: "seed",
        at: new Date(day),
      });
    }
  }

  if (batch.length) await prisma.employeeTrackPoint.createMany({ data: batch });
}

/** 15 dakikalık grid kontrolü */
function roundToQuarter(date) {
  const d = new Date(date);
  const m = d.getMinutes();
  d.setMinutes(m - (m % 15), 0, 0);
  return d;
}

/** Çalışan için ileri tarihe plan (ScheduleEvent) — çakışmasız */
async function seedScheduleForEmployee(emp, stores, plannedBy) {
  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + 10);

  await prisma.scheduleEvent.deleteMany({
    where: { employeeId: emp.id, AND: [{ start: { gte: from } }, { end: { lte: to } }] },
  });

  const dayCount = 7;
  const slotsPerDay = 2;
  let storeIdx = 0;

  for (let d = 0; d < dayCount; d++) {
    const baseDay = new Date();
    baseDay.setDate(baseDay.getDate() + d + 1);

    for (let s = 0; s < slotsPerDay; s++) {
      if (!stores.length) break;

      const store = stores[storeIdx % stores.length];
      storeIdx++;

      const startHour = s === 0 ? 10 : 13 + (Math.random() < 0.5 ? 0 : 1);
      const start = roundToQuarter(new Date(baseDay.setHours(startHour, 0, 0, 0)));
      const end = new Date(start.getTime() + 90 * 60 * 1000);

      const status = Math.random() < 0.25 ? "COMPLETED" : "PLANNED";

      await prisma.scheduleEvent.create({
        data: {
          title: "Planlı Ziyaret",
          notes: Math.random() < 0.3 ? "Ön temizlik ve risk kontrolü yapılacak." : null,
          employeeId: emp.id,
          storeId: store.id,
          start,
          end,
          status,
          plannedById: plannedBy.id,
          plannedByRole: plannedBy.role,
          plannedByName: plannedBy.name,
        },
      });
    }
  }
}

/**
 * POST /api/seed/run
 * - Sadece admin
 * - Idempotent (upsert)
 * - Admin/Employee şifreleri: 123456
 */
router.post("/run", auth, roleCheck(["admin"]), async (_req, res) => {
  try {
    const DEFAULT_PASSWORD = "123456";
    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    /* ---------------------- 1) Admin(ler) ---------------------- */
    const adminsSeed = [
      { fullName: "Sistem Yöneticisi",  email: "yonetim@pest.local" },
      { fullName: "Operasyon Admini",   email: "operasyon@pest.local" },
    ];
    const admins = [];
    for (const a of adminsSeed) {
      const admin = await prisma.admin.upsert({
        where: { email: a.email },
        update: { fullName: a.fullName, password: hashedPassword },
        create: { fullName: a.fullName, email: a.email, password: hashedPassword },
      });
      admins.push(admin);
    }
    const plannedBy = { id: admins[0].id, role: "admin", name: admins[0].fullName || admins[0].email };

    /* -------------------- 2) Employee(ler) --------------------- */
    const employeesSeed = [
      { fullName: "Ahmet Karaca", email: "ahmet.karaca@pest.local", jobTitle: "Servis Sorumlusu", gsm: "0554 123 45 67", adminId: admins[0].id },
      { fullName: "Emre Çetin",   email: "emre.cetin@pest.local",   jobTitle: "Tekniker",         gsm: "0553 456 78 90", adminId: admins[0].id },
      { fullName: "Burak Kılıç",  email: "burak.kilic@pest.local",  jobTitle: "Ekip Lideri",      gsm: "0552 987 65 43", adminId: admins[0].id },
    ];
    const employees = [];
    for (const e of employeesSeed) {
      const emp = await prisma.employee.upsert({
        where: { email: e.email },
        update: { fullName: e.fullName, jobTitle: e.jobTitle, gsm: e.gsm, adminId: e.adminId, password: hashedPassword },
        create: { fullName: e.fullName, email: e.email, jobTitle: e.jobTitle, gsm: e.gsm, adminId: e.adminId, password: hashedPassword },
      });
      employees.push(emp);
    }
    const pickEmployee = (i) => employees[i % employees.length];

    /* ---------------- 3) ProviderProfile (tek) ----------------- */
    await prisma.providerProfile.upsert({
      where: { id: 1 },
      update: {
        companyName:       "TURA ÇEVRE SAĞLIĞI HİZMETLERİ",
        address:           "Örnek Mah. Servis Sk. No:10, İzmir",
        responsibleTitle:  "Ziraat Mühendisi",
        responsibleName:   "Dr. Ayşe Demir",
        phoneFax:          "0 (232) 000 00 00",
        certificateSerial: "PEST-0000001",
        permissionNo:      "İl Sağlık Md. 01.01.2024 / 12345",
      },
      create: {
        id:                1,
        companyName:       "TURA ÇEVRE SAĞLIĞI HİZMETLERİ",
        address:           "Örnek Mah. Servis Sk. No:10, İzmir",
        responsibleTitle:  "Ziraat Mühendisi",
        responsibleName:   "Dr. Ayşe Demir",
        phoneFax:          "0 (232) 000 00 00",
        certificateSerial: "PEST-0000001",
        permissionNo:      "İl Sağlık Md. 01.01.2024 / 12345",
      },
    });

    /* -------------------- 4) Biocidaller ----------------------- */
    const biocideSeed = [
      { name: "DeltaMax 2.5", activeIngredient: "Deltamethrin", antidote: "Semptomatik", unit: "ML" },
      { name: "Fipronil Jel", activeIngredient: "Fipronil",     antidote: "Semptomatik", unit: "GR" },
      { name: "Brodifacoum",  activeIngredient: "Brodifacoum",  antidote: "K Vitamini",  unit: "GR" },
      { name: "Permex 25",    activeIngredient: "Permethrin",   antidote: "Semptomatik", unit: "ML" },
    ];
    for (const b of biocideSeed) {
      await prisma.biocide.upsert({
        where: { name_activeIngredient: { name: b.name, activeIngredient: b.activeIngredient } },
        update: { antidote: b.antidote, unit: b.unit },
        create: b,
      });
    }
    const allBiocides = await prisma.biocide.findMany();

    /* ---------------------- 5) Customers ----------------------- */
    const customersSeed = [
      {
        code: "CUST-0001",
        title: "Tura Gıda A.Ş.",
        accountingTitle: "Tura Gıda",
        email: "tura@customer.local",
        contactFullName: "Mete Yalçın",
        phone: "0 (232) 111 11 11",
        gsm: "0 (555) 111 11 11",
        taxOffice: "Konak VD",
        taxNumber: "1234567890",
        address: "Gıda OSB, No:12",
        city: "İZMİR",
        showBalance: true,
        visitPeriod: "IKIAYLIK",
        employeeId: pickEmployee(0).id, // seed içi yardımcı alan
      },
      {
        code: "CUST-0002",
        title: "Ege Lojistik Ltd.",
        accountingTitle: "Ege Lojistik",
        email: "ege@customer.local",
        contactFullName: "Sevil Er",
        phone: "0 (232) 222 22 22",
        gsm: "0 (555) 222 22 22",
        taxOffice: "Bornova VD",
        taxNumber: "0987654321",
        address: "Lojistik Mah., No:5",
        city: "İZMİR",
        showBalance: false,
        visitPeriod: pick(VisitPeriods),
        employeeId: pickEmployee(1).id,
      },
      {
        code: "CUST-0003",
        title: "Marmara Tekstil",
        accountingTitle: "Marmara Tekstil",
        email: "marmara@customer.local",
        contactFullName: "Hakan Güler",
        phone: "0 (262) 333 33 33",
        gsm: "0 (555) 333 33 33",
        taxOffice: "İzmit VD",
        taxNumber: "6677889900",
        address: "Sanayi Cd., No:3",
        city: "KOCAELİ",
        showBalance: false,
        visitPeriod: pick(VisitPeriods),
        employeeId: pickEmployee(2).id,
      },
    ];

    // Müşteri -> çalışan eşleşmesi (seed içi)
    const custEmpMap = new Map();

    const customers = [];
    for (const c of customersSeed) {
      const { employeeId, ...rest } = c; // Prisma'ya employeeId göndermiyoruz
      const rel = employeeId ? { employee: { connect: { id: employeeId } } } : {};
      const dataBase = { ...rest }; // <-- Customer'da password yok!

      const cd = await prisma.customer.upsert({
        where: { code: c.code },
        update: { ...dataBase, ...rel },
        create: { ...dataBase, ...rel },
      });

      customers.push(cd);
      if (employeeId) custEmpMap.set(cd.id, employeeId);
    }

    /* ----------------------- 6) Stores ------------------------- */
    const stores = [];
    for (const c of customers) {
      const base = CITY_COORDS[String(c.city || "").toUpperCase()] || CITY_COORDS[""];
      const [bLat, bLng] = base;

      const twoStores = [
        {
          name: `${c.title} Merkez`,
          code: "MRKZ",
          city: c.city,
          address: c.address,
          phone: c.phone,
          manager: c.contactFullName,
          isActive: true,
          pestType: pick(PestTypes),
          placeType: pick(PlaceTypes),
          areaM2: randInt(500, 6000),
          ...( (() => { const [lat, lng] = jitterAround(bLat, bLng, 800); return { latitude: lat, longitude: lng }; })() ),
        },
        {
          name: `${c.title} Şube-1`,
          code: "S1",
          city: c.city,
          address: c.address,
          phone: c.gsm,
          manager: c.contactFullName,
          isActive: true,
          pestType: pick(PestTypes),
          placeType: pick(PlaceTypes),
          areaM2: randInt(400, 4000),
          ...( (() => { const [lat, lng] = jitterAround(bLat, bLng, 1600); return { latitude: lat, longitude: lng }; })() ),
        },
      ];

      for (const s of twoStores) {
        const st = await prisma.store.upsert({
          where: { customerId_code: { customerId: c.id, code: s.code } },
          update: { ...s },
          create: { customerId: c.id, ...s },
        });
        stores.push(st);
      }
    }

    /* ---------------------- 7) Stations ------------------------ */
    const stations = [];
    for (const st of stores) {
      const count = randInt(5, 9);
      for (let i = 1; i <= count; i++) {
        const type = pick(StationTypes);
        const code = `S-${String(i).padStart(3, "0")}`;
        const name = `${type.replace(/_/g, " ")} ${i}`;

        const sta = await prisma.station.upsert({
          where: { storeId_code: { storeId: st.id, code } },
          update: { type, name, isActive: true },
          create: { storeId: st.id, type, name, code, isActive: true },
        });
        stations.push(sta);
      }
    }

    /* ----- 8) Yakın dönem aktivasyonları temizle + yeniden ekle ----- */
    const cutoffAct = new Date();
    cutoffAct.setDate(cutoffAct.getDate() - 90);

    await prisma.stationActivation.deleteMany({
      where: { observedAt: { gte: cutoffAct }, stationId: { in: stations.map(x => x.id) } },
    });

    for (const sta of stations) {
      const howMany = randInt(2, 4);
      for (let k = 0; k < howMany; k++) {
        const daysAgo = randInt(3, 80);
        const observedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
        const payload = makeActivationPayload(sta.type);

        await prisma.stationActivation.create({
          data: {
            storeId: sta.storeId,
            stationId: sta.id,
            visitId: null,
            type: sta.type,
            observedAt,
            ...payload,
          },
        });
      }
    }

    /* ----------------------- 9) Visits + EK1 ------------------- */
    const cutoffVisit = new Date();
    cutoffVisit.setDate(cutoffVisit.getDate() - 60);
    await prisma.visit.deleteMany({
      where: { storeId: { in: stores.map(s => s.id) }, date: { gte: cutoffVisit } },
    });

    const visits = [];
    for (const st of stores) {
      const visitCount = randInt(2, 3);
      for (let i = 0; i < visitCount; i++) {
        const daysAgo = randInt(1, 45);
        const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
        const visitType = pick(VisitTypes);
        const staff = [pickEmployee(i), pickEmployee(i + 1)];

        const visit = await prisma.visit.create({
          data: {
            storeId: st.id,
            date,
            startTime: "09:00",
            endTime: "11:30",
            visitType,
            targetPests: ["Kemirgen", "Uçan", "Haşere"].slice(0, randInt(1, 3)),
            notes: Math.random() < 0.35 ? "Planlı saha ziyareti yapıldı." : null,
            employees: staff.map(e => ({ id: e.id, name: e.fullName })),
            ek1: { create: {} },
          },
          include: { ek1: true },
        });

        const lineCount = randInt(1, 3);
        for (let li = 0; li < lineCount; li++) {
          const bio = pick(allBiocides);
          const method = pick(AppMethods);
          const amount = (bio.unit === "ML" || bio.unit === "LT") ? randInt(50, 250) : randInt(10, 120);

          await prisma.ek1Line.create({
            data: {
              visitId: visit.id,
              biosidalId: bio.id,
              method,
              amount,
            },
          });
        }

        const stasOfStore = stations.filter(s => s.storeId === st.id);
        const selected = [...stasOfStore].sort(() => Math.random() - 0.5).slice(0, Math.min(3, stasOfStore.length));
        for (const sta of selected) {
          const payload = makeActivationPayload(sta.type);
          await prisma.stationActivation.create({
            data: {
              storeId: st.id,
              stationId: sta.id,
              visitId: visit.id,
              type: sta.type,
              observedAt: visit.date,
              ...payload,
            },
          });
        }

        visits.push(visit);
      }
    }

    /* -------------------- 10) Nonconformities ------------------ */
    const cutoffNcr = new Date();
    cutoffNcr.setDate(cutoffNcr.getDate() - 30);
    await prisma.nonconformity.deleteMany({
      where: { storeId: { in: stores.map(s => s.id) }, observedAt: { gte: cutoffNcr } },
    });

    const NCR_CATS = ["HIJYEN", "DEPOLAMA", "YAPISAL", "DIGER"];
    for (const st of stores) {
      if (Math.random() < 0.6) {
        const observedAt = new Date(Date.now() - randInt(2, 25) * 24 * 60 * 60 * 1000);
        await prisma.nonconformity.create({
          data: {
            storeId: st.id,
            category: pick(NCR_CATS),
            title: "Kontrol esnasında tespit edilen uygunsuzluk",
            notes: "Giderilmesi için bilgilendirme yapıldı.",
            image: null,
            observedAt,
          },
        });
      }
    }

    /* ------------------ 11) Çalışan rotaları ------------------- */
    for (const emp of employees) {
      const anyCustomer = await prisma.customer.findFirst({
        where: { employee: { is: { id: emp.id } } },
        orderBy: { createdAt: "asc" },
      });
      const base = CITY_COORDS[String(anyCustomer?.city || "").toUpperCase()] || CITY_COORDS[""];
      const [bLat, bLng] = base;
      await seedTracksForEmployee(emp.id, bLat, bLng);
    }

    /* ------------------ 12) Ziyaret planları ------------------- */
    for (const emp of employees) {
      const storesOfEmpCustomers = stores.filter(st => custEmpMap.get(st.customerId) === emp.id);
      const subset = [...storesOfEmpCustomers].sort(() => Math.random() - 0.5).slice(0, Math.min(4, storesOfEmpCustomers.length));
      await seedScheduleForEmployee(emp, subset, plannedBy);
    }

    /* --------------------------- Özet -------------------------- */
    res.json({
      message: "Seed tamamlandı (Admin/Employee şifreleri 123456 — Customer için şifre alanı yok)",
      summary: {
        admins: admins.map(a => ({ id: a.id, name: a.fullName, email: a.email })),
        employees: employees.map(e => ({ id: e.id, name: e.fullName, email: e.email })),
        customers: customers.map(c => ({ id: c.id, code: c.code, title: c.title })),
        stores: stores.length,
        stations: stations.length,
        visits: visits.length,
        biocides: allBiocides.length,
        schedulesSeededDays: 10,
        tracksSeededDays: 7,
      },
    });
  } catch (err) {
    console.error("SEED /run error:", err);
    res.status(500).json({ error: "Seed çalıştırılamadı" });
  }
});

export default router;
