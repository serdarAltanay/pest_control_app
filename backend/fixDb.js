import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        await prisma.$executeRawUnsafe('ALTER TABLE RefreshToken MODIFY token VARCHAR(500);');
        console.log("Token column resized successfully.");
    } catch (error) {
        console.error("Error resizing column:", error);
    } finally {
        await prisma.$disconnect();
    }
}
main();
