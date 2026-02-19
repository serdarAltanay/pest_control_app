// scripts/set-profile-photos.js
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient();
const AVATAR_DIR = path.join(process.cwd(), "uploads", "avatars");

// Ensure directory exists
if (!fs.existsSync(AVATAR_DIR)) fs.mkdirSync(AVATAR_DIR, { recursive: true });

const BRAIN_DIR = "C:\\Users\\Serdar\\.gemini\\antigravity\\brain\\ea405365-3a6f-4d01-bd37-af39e72d6b02";

async function main() {
    // Get all admins and employees
    const admins = await prisma.admin.findMany({ orderBy: { id: "asc" } });
    const employees = await prisma.employee.findMany({ orderBy: { id: "asc" } });

    // Map source images
    const sourceImages = [
        path.join(BRAIN_DIR, "profile_admin_1771535567201.png"),
        path.join(BRAIN_DIR, "profile_employee1_1771535585643.png"),
        path.join(BRAIN_DIR, "profile_employee2_1771535598925.png"),
        path.join(BRAIN_DIR, "profile_employee3_1771535622502.png"),
    ];

    // Verify source images exist
    for (const src of sourceImages) {
        if (!fs.existsSync(src)) {
            console.error("Source image not found:", src);
            process.exit(1);
        }
    }

    let imgIdx = 0;

    // Assign to admins
    for (const admin of admins) {
        const src = sourceImages[imgIdx % sourceImages.length];
        const destFilename = `admin-${admin.id}-profile.png`;
        const destPath = path.join(AVATAR_DIR, destFilename);
        const relativePath = `uploads/avatars/${destFilename}`;

        fs.copyFileSync(src, destPath);
        await prisma.admin.update({
            where: { id: admin.id },
            data: { profileImage: relativePath },
        });
        console.log(`Admin "${admin.fullName}" (id:${admin.id}) -> ${relativePath}`);
        imgIdx++;
    }

    // Assign to employees
    for (const emp of employees) {
        const src = sourceImages[imgIdx % sourceImages.length];
        const destFilename = `employee-${emp.id}-profile.png`;
        const destPath = path.join(AVATAR_DIR, destFilename);
        const relativePath = `uploads/avatars/${destFilename}`;

        fs.copyFileSync(src, destPath);
        await prisma.employee.update({
            where: { id: emp.id },
            data: { profileImage: relativePath },
        });
        console.log(`Employee "${emp.fullName}" (id:${emp.id}) -> ${relativePath}`);
        imgIdx++;
    }

    console.log(`\nToplam ${admins.length} admin, ${employees.length} employee guncellendi.`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
