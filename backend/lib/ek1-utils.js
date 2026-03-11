import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * Üretilecek sonraki seri numarasını döner.
 */
export async function getNextSerialNo() {
  const last = await prisma.ek1Report.findFirst({
    where: { serialNo: { not: null } },
    orderBy: { serialNo: "desc" },
    select: { serialNo: true },
  });
  return (last?.serialNo ?? 0) + 1;
}

/**
 * Visit için rapor kaydı yoksa oluşturur.
 * Varsa ve seri numarası eksikse (null), atamasını yapar.
 */
export async function ensureReport(visitId) {
  let report = await prisma.ek1Report.findUnique({ where: { visitId } });
  
  if (!report) {
    const serialNo = await getNextSerialNo();
    report = await prisma.ek1Report.create({ 
      data: { visitId, status: "DRAFT", serialNo } 
    });
    console.log(`[EK1-UTILS] Created new report for visit #${visitId} with serial ${serialNo}`);
  } else if (report.serialNo === null) {
    const serialNo = await getNextSerialNo();
    report = await prisma.ek1Report.update({
      where: { visitId },
      data: { serialNo }
    });
    console.log(`[EK1-UTILS] Backfilled serial ${serialNo} for existing report of visit #${visitId}`);
  }
  
  return report;
}
