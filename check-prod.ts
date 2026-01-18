import { PrismaClient } from '@prisma/client';

// Usar conexión directa, no Accelerate
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function main() {
  const plans = await prisma.planConfig.findMany({
    include: {
      menuItems: {
        orderBy: { orden: 'asc' }
      }
    }
  });

  for (const plan of plans) {
    console.log(`\n${plan.plan}: ${plan.menuItems.length} menús`);
    plan.menuItems.forEach(m => {
      console.log(`  - ${m.menuKey} (enabled=${m.isEnabled})`);
    });
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
