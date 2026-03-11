/**
 * Belirtilen e-postanın Admin, Employee veya AccessOwner tablolarından 
 * herhangi birinde olup olmadığını kontrol eder.
 * 
 * @param {import('@prisma/client').PrismaClient} prisma 
 * @param {string} email 
 * @returns {Promise<boolean>}
 */
export async function isEmailTaken(prisma, email) {
  if (!email) return false;
  const trimmed = String(email).trim().toLowerCase();

  const [admin, employee, owner] = await Promise.all([
    prisma.admin.findUnique({ where: { email: trimmed } }),
    prisma.employee.findUnique({ where: { email: trimmed } }),
    prisma.accessOwner.findUnique({ where: { email: trimmed } }),
  ]);

  return !!(admin || employee || owner);
}
