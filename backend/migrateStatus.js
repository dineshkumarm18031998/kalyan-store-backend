const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const bookings = await prisma.booking.findMany();
  for (const b of bookings) {
    let status = 'ACTIVE';
    if (b.returned) {
      const tr = (b.paidAmount || 0) + (b.additionalPayment || 0);
      const tb = b.totalAmount || 0;
      const diff = tr - tb;
      if (diff === 0 && tb > 0) status = 'CLOSED';
      else if (diff > 0 && b.advanceReturned) status = 'CLOSED';
      else status = 'RETURNED';
    }
    await prisma.booking.update({
      where: { id: b.id },
      data: { status }
    });
  }
  console.log('Migrated', bookings.length, 'bookings');
}

main().catch(console.error).finally(() => prisma.$disconnect());
