const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const stations = await prisma.station.findMany({
    where: {
      groupId: { not: null }
    },
    take: 10,
    select: {
      id: true,
      name: true,
      code: true,
      groupId: true,
      isGroup: true,
      totalCount: true
    }
  });
  console.log(JSON.stringify(stations, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
