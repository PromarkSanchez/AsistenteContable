import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Migración: Crear registros CompanyMember OWNER para todas las empresas existentes.
 * Esto asegura retrocompatibilidad con el nuevo sistema de acceso por membresías.
 */
async function main() {
  console.log('Iniciando migración de miembros de empresa...');

  // Obtener todas las empresas con su userId (dueño original)
  const companies = await prisma.company.findMany({
    select: {
      id: true,
      userId: true,
      razonSocial: true,
    },
  });

  console.log(`Encontradas ${companies.length} empresas para migrar.`);

  let created = 0;
  let skipped = 0;

  for (const company of companies) {
    // Verificar si ya existe el registro
    const existing = await prisma.companyMember.findUnique({
      where: {
        companyId_userId: {
          companyId: company.id,
          userId: company.userId,
        },
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    // Crear registro CompanyMember con rol OWNER
    await prisma.companyMember.create({
      data: {
        companyId: company.id,
        userId: company.userId,
        role: 'OWNER',
      },
    });

    created++;
    console.log(`  OWNER creado para: ${company.razonSocial}`);
  }

  console.log(`\nMigración completada:`);
  console.log(`  - Creados: ${created}`);
  console.log(`  - Ya existían: ${skipped}`);
  console.log(`  - Total empresas: ${companies.length}`);
}

main()
  .catch((e) => {
    console.error('Error en migración:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
