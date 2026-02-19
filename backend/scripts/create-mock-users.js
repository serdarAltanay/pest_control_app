// scripts/create-mock-users.js
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient();

async function main() {
    const password = await bcrypt.hash("123456", 10);

    // 1) Admin (zaten varsa güncelle)
    const admin = await prisma.admin.upsert({
        where: { email: "admin@admin.com" },
        update: { password },
        create: {
            fullName: "Admin Kullanıcı",
            email: "admin@admin.com",
            password,
        },
    });
    console.log("✅ Admin:", admin.email, "(şifre: 123456)");

    // 2) Employee (çalışan)
    const employee = await prisma.employee.upsert({
        where: { email: "employee@test.com" },
        update: { password, fullName: "Ahmet Yılmaz", jobTitle: "Teknisyen", gsm: "0555 111 22 33" },
        create: {
            fullName: "Ahmet Yılmaz",
            email: "employee@test.com",
            password,
            jobTitle: "Teknisyen",
            gsm: "0555 111 22 33",
            adminId: admin.id,
        },
    });
    console.log("✅ Employee:", employee.email, "(şifre: 123456)");

    // 3) Customer (AccessOwner) — müşteri paneli girişi
    const customer = await prisma.accessOwner.upsert({
        where: { email: "customer@test.com" },
        update: { password, firstName: "Mete", lastName: "Yalçın", role: "MAGAZA_MUDURU" },
        create: {
            email: "customer@test.com",
            password,
            firstName: "Mete",
            lastName: "Yalçın",
            phone: "0555 444 55 66",
            role: "MAGAZA_MUDURU",
        },
    });
    console.log("✅ Customer (AccessOwner):", customer.email, "(şifre: 123456, login role: customer)");

    // 4) Customer'a AccessGrant oluştur (müşteri mağazalarına erişim)
    // Mevcut müşterilere bağla
    const allCustomers = await prisma.customer.findMany({ select: { id: true, title: true } });

    if (allCustomers.length > 0) {
        for (const c of allCustomers) {
            const existing = await prisma.accessGrant.findFirst({
                where: { ownerId: customer.id, scopeType: "CUSTOMER", customerId: c.id }
            });
            if (!existing) {
                await prisma.accessGrant.create({
                    data: {
                        ownerId: customer.id,
                        scopeType: "CUSTOMER",
                        customerId: c.id,
                    },
                });
                console.log(`   → AccessGrant: ${c.title} (id:${c.id})`);
            }
        }
    } else {
        console.log("   ⚠ Henüz müşteri kaydı yok. Önce seed çalıştırın.");
    }

    console.log("\n=== Giriş Bilgileri ===");
    console.log("Admin:    admin@admin.com    / 123456");
    console.log("Employee: employee@test.com  / 123456");
    console.log("Customer: customer@test.com  / 123456");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
