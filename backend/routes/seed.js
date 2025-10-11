// routes/seed.js
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { auth, roleCheck } from "../middleware/auth.js";

const router = Router();
const prisma = new PrismaClient();

/**
 * POST /api/seed/run
 * - Sadece admin
 * - Idempotent (upsert)
 * - Tüm kullanıcı şifreleri: 123456
 */
router.post("/run", auth, roleCheck(["admin"]), async (_req, res) => {
  try {
    const DEFAULT_PASSWORD = "123456";
    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    /* -------------------- 1) Admin(ler) -------------------- */
    const adminsInput = [
      { fullName: "Sistem Yöneticisi",  email: "yonetim@pest.local" },
      { fullName: "Operasyon Admini",   email: "operasyon@pest.local" },
    ];

    const admins = [];
    for (const a of adminsInput) {
      const admin = await prisma.admin.upsert({
        where: { email: a.email },
        update: { fullName: a.fullName, password: hashedPassword },
        create: { fullName: a.fullName, email: a.email, password: hashedPassword },
      });
      admins.push(admin);
    }
    const defaultAdminId = admins[0].id;

    /* ------------------- 2) Employee(ler) ------------------ */
    const employeesInput = [
      { fullName: "Selin Karaca", email: "selin.karaca@pest.local", jobTitle: "Servis Sorumlusu", gsm: "0554 123 45 67", adminId: defaultAdminId },
      { fullName: "Emre Çetin",   email: "emre.cetin@pest.local",   jobTitle: "Tekniker",         gsm: "0553 456 78 90", adminId: defaultAdminId },
      { fullName: "Burak Kılıç",  email: "burak.kilic@pest.local",  jobTitle: "Ekip Lideri",      gsm: "0552 987 65 43", adminId: defaultAdminId },
    ];

    const employees = [];
    for (const e of employeesInput) {
      const emp = await prisma.employee.upsert({
        where: { email: e.email },
        update: {
          fullName: e.fullName, jobTitle: e.jobTitle, gsm: e.gsm,
          adminId: e.adminId, password: hashedPassword,
        },
        create: {
          fullName: e.fullName, email: e.email, password: hashedPassword,
          jobTitle: e.jobTitle, gsm: e.gsm, adminId: e.adminId,
        },
      });
      employees.push(emp);
    }
    const pickEmployeeId = (i) => employees[i % employees.length].id;

    /* --------------- 3) ProviderProfile (tek) -------------- */
    await prisma.providerProfile.upsert({
      where: { id: 1 }, // tek kayıt
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

    /* ---------------- 4) Customer(lar) (upsert) ------------ */
    // DİKKAT: pestType / placeType / areaM2 artık Customer'a yazılmıyor (Store'a)!
    const customersInput = [
      {
        code: "202500001",
        title: "DEPOOS YEDEK PARÇA",
        accountingTitle: "DEPOOS YEDEK PARÇA TİC. LTD. ŞTİ.",
        email: "info@depoos.com",
        contactFullName: "Mehmet Türe",
        phone: "0232 321 45 67",
        gsm: "0532 111 22 33",
        taxOffice: "İZMİR",
        taxNumber: "1234567890",
        address: "Atatürk OSB Mah. 1006 Sk. No:12",
        city: "İZMİR",
        showBalance: false,
        visitPeriod: "AYLIK",
        employeeId: pickEmployeeId(0),

        // mağaza meta (Store'a yazılacak)
        storePlaceType: "DEPO",
        storeAreaM2: 1200,
      },
      {
        code: "202500002",
        title: "YAKIN İNSAN KAYNAKLARI",
        accountingTitle: "YAKIN İK DANIŞMANLIK A.Ş.",
        email: "info@yakindanisman.com.tr",
        contactFullName: "Pelin Saygın",
        phone: "0256 444 00 12",
        gsm: "0544 444 00 12",
        taxOffice: "AYDIN",
        taxNumber: "9876543210",
        address: "Efeler Mah. 158 Sk. No:3",
        city: "AYDIN",
        showBalance: true,
        visitPeriod: "IKIAYLIK",
        employeeId: pickEmployeeId(1),

        storePlaceType: "OFIS",
        storeAreaM2: 450,
      },
      {
        code: "202500003",
        title: "TURA ÇEVRE",
        accountingTitle: "TURA ÇEVRE HİZMETLERİ LTD.",
        email: "ankara@turacevre.com",
        contactFullName: "Tolga Uğur",
        phone: "0312 555 44 33",
        gsm: "0533 555 44 33",
        taxOffice: "ANKARA",
        taxNumber: "1122334455",
        address: "Mustafa Kemal Mh. 2159 Cd. No:7",
        city: "ANKARA",
        showBalance: false,
        visitPeriod: "HAFTALIK",
        employeeId: pickEmployeeId(2),

        storePlaceType: "FABRIKA",
        storeAreaM2: 900,
      },
      {
        code: "202500004",
        title: "KARDELEN MARKET",
        accountingTitle: "KARDELEN GIDA SAN. TİC. LTD.",
        email: "iletisim@kardelengida.com",
        contactFullName: "Neslihan Kar",
        phone: "0212 333 22 11",
        gsm: "0507 333 22 11",
        taxOffice: "İSTANBUL",
        taxNumber: "5566778899",
        address: "Bağcılar Mh. Güneş Cd. No:21",
        city: "İSTANBUL",
        showBalance: true,
        visitPeriod: "AYLIK",
        employeeId: pickEmployeeId(0),

        storePlaceType: "MAGAZA",
        storeAreaM2: 300,
      },
      {
        code: "202500005",
        title: "EFE TEKSTİL",
        accountingTitle: "EFE TEKSTİL SANAYİ A.Ş.",
        email: "info@efetekstil.com",
        contactFullName: "Cem Efe",
        phone: "0232 777 66 55",
        gsm: "0555 777 66 55",
        taxOffice: "İZMİR",
        taxNumber: "6677889900",
        address: "Çiğli OSB 2. Bölge 1202/5 Sk. No:6",
        city: "İZMİR",
        showBalance: false,
        visitPeriod: "UCAYLIK",
        employeeId: pickEmployeeId(1),

        storePlaceType: "FABRIKA",
        storeAreaM2: 2500,
      },
      {
        code: "202500006",
        title: "KUZUCUOĞLU LOJİSTİK",
        accountingTitle: "KUZUCUOĞLU LOJİSTİK A.Ş.",
        email: "destek@kuzuculoglu.com",
        contactFullName: "Hakan Kuzu",
        phone: "0216 999 11 22",
        gsm: "0536 999 11 22",
        taxOffice: "İSTANBUL",
        taxNumber: "9988776655",
        address: "Tuzla Aydınlı Mah. 1. Cad. No:4",
        city: "İSTANBUL",
        showBalance: false,
        visitPeriod: "IKIHAFTALIK",
        employeeId: pickEmployeeId(2),

        storePlaceType: "DEPO",
        storeAreaM2: 1800,
      },
      {
        code: "202500007",
        title: "MAVİSU KOZMETİK",
        accountingTitle: "MAVİSU KOZMETİK LTD.",
        email: "musteri@mavisu.com",
        contactFullName: "Seda Mavi",
        phone: "0232 765 43 21",
        gsm: "0542 765 43 21",
        taxOffice: "İZMİR",
        taxNumber: "3344556677",
        address: "Karşıyaka Mavişehir Mh. 8459 Sk. No:19",
        city: "İZMİR",
        showBalance: true,
        visitPeriod: "AYLIK",
        employeeId: pickEmployeeId(1),

        storePlaceType: "OFIS",
        storeAreaM2: 650,
      },
      {
        code: "202500008",
        title: "DALGA PLASTİK",
        accountingTitle: "DALGA PLASTİK SAN. TİC. LTD.",
        email: "info@dalgaplastik.com",
        contactFullName: "Levent Dal",
        phone: "0262 345 67 89",
        gsm: "0530 345 67 89",
        taxOffice: "KOCAELİ",
        taxNumber: "2211334455",
        address: "Gebze İMES OSB 3. Cd. No:10",
        city: "KOCAELİ",
        showBalance: false,
        visitPeriod: "IKIAYLIK",
        employeeId: pickEmployeeId(0),

        storePlaceType: "FABRIKA",
        storeAreaM2: 1400,
      },
    ];

    const customers = [];
    for (const c of customersInput) {
      // Customer'a yazılmayacak alanları ayır
      const {
        storePlaceType,
        storeAreaM2,
        ...customerData
      } = c;

      const cd = await prisma.customer.upsert({
        where: { code: c.code },
        update: {
          ...customerData,
          password: hashedPassword, // hepsi 123456
        },
        create: {
          ...customerData,
          password: hashedPassword,
        },
      });
      customers.push({ db: cd, storeMeta: { placeType: storePlaceType, areaM2: storeAreaM2 } });
    }

    /* --------------- 5) Her müşteri için mağazalar --------- */
    for (const { db: cdb, storeMeta } of customers) {
      const samples = [
        {
          name: `${cdb.title} Merkez`,
          code: "MRKZ",
          city: cdb.city,
          address: cdb.address,
          phone: cdb.phone,
          manager: cdb.contactFullName,
          isActive: true,
          placeType: storeMeta.placeType || "BELIRTILMEDI",
          areaM2: storeMeta.areaM2 ?? null,
        },
        {
          name: `${cdb.title} Şube-1`,
          code: "S1",
          city: cdb.city,
          address: cdb.address,
          phone: cdb.gsm,
          manager: cdb.contactFullName,
          isActive: true,
          placeType: storeMeta.placeType || "BELIRTILMEDI",
          areaM2: storeMeta.areaM2 ?? null,
        },
      ];

      for (const s of samples) {
        await prisma.store.upsert({
          where: { customerId_code: { customerId: cdb.id, code: s.code } },
          update: {
            name: s.name,
            city: s.city,
            address: s.address,
            phone: s.phone,
            manager: s.manager,
            isActive: s.isActive,
            placeType: s.placeType,
            areaM2: s.areaM2,
          },
          create: {
            customerId: cdb.id,
            name: s.name,
            code: s.code,
            city: s.city,
            address: s.address,
            phone: s.phone,
            manager: s.manager,
            isActive: s.isActive,
            placeType: s.placeType,
            areaM2: s.areaM2,
          },
        });
      }
    }

    /* ----------------- 6) Örnek Biyosidaller ---------------- */
    const biocideInput = [
      { name: "DeltaMax 2.5", activeIngredient: "Deltamethrin", antidote: "Semptomatik", unit: "ML" },
      { name: "Fipronil Jel",  activeIngredient: "Fipronil",    antidote: "Semptomatik", unit: "GR" },
      { name: "Brodifacoum",   activeIngredient: "Brodifacoum", antidote: "K Vitamini",  unit: "GR" },
      { name: "Permex 25",     activeIngredient: "Permethrin",  antidote: "Semptomatik", unit: "ML" },
    ];
    for (const b of biocideInput) {
      await prisma.biocide.upsert({
        where: { name_activeIngredient: { name: b.name, activeIngredient: b.activeIngredient } },
        update: { antidote: b.antidote, unit: b.unit },
        create: b,
      });
    }

    /* -------------------- Yanıt / Özet ---------------------- */
    res.json({
      message: "Seed başarıyla tamamlandı (tüm şifreler 123456)",
      summary: {
        admins: admins.map(a => ({ id: a.id, fullName: a.fullName, email: a.email })),
        employees: employees.map(e => ({ id: e.id, fullName: e.fullName, email: e.email })),
        customers: customers.map(c => ({ id: c.db.id, code: c.db.code, title: c.db.title })),
        storesPerCustomer: 2,
        biocides: biocideInput.length,
        providerProfile: true,
      },
    });
  } catch (err) {
    console.error("SEED /run error:", err);
    res.status(500).json({ error: "Seed çalıştırılamadı" });
  }
});

export default router;
